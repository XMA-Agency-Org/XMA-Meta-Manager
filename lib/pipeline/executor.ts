import * as fs from "node:fs"
import * as path from "node:path"
import { parse as parseYaml } from "yaml"
import type { MetaApiClient } from "@/lib/meta-api"
import { createAd } from "./ad-creator"
import { createAdSet } from "./adset-creator"
import { createCampaign } from "./campaign-creator"
import { loadConfig } from "./config-loader"
import { PipelineContext } from "./context"
import { uploadCreatives } from "./creative-uploader"
import { persistPipelineResult } from "@/db/persist"
import { writeResult } from "./result-writer"

function loadExistingIds(configDir: string): {
	adSets: Map<string, string>
	adCreatives: Map<string, string>
	ads: Map<string, string>
} {
	const resultPath = path.join(configDir, "_result.yaml")
	const adSets = new Map<string, string>()
	const adCreatives = new Map<string, string>()
	const ads = new Map<string, string>()

	if (!fs.existsSync(resultPath)) return { adSets, adCreatives, ads }

	try {
		const raw = fs.readFileSync(resultPath, "utf-8")
		const result = parseYaml(raw)
		if (Array.isArray(result?.adSets)) {
			for (const entry of result.adSets) {
				if (entry.ref && entry.metaId) {
					adSets.set(entry.ref, String(entry.metaId))
				}
			}
		}
		if (Array.isArray(result?.adCreatives)) {
			for (const entry of result.adCreatives) {
				if (entry.ref && entry.metaId) {
					adCreatives.set(entry.ref, String(entry.metaId))
				}
			}
		}
		if (Array.isArray(result?.ads)) {
			for (const entry of result.ads) {
				if (entry.ref && entry.metaId) {
					ads.set(entry.ref, String(entry.metaId))
				}
			}
		}
	} catch {
		// ignore parse errors
	}

	return { adSets, adCreatives, ads }
}

export interface ExecutorOptions {
	dryRun?: boolean
}

export async function runPipeline(
	configPath: string,
	client: MetaApiClient,
	options: ExecutorOptions = {},
): Promise<void> {
	const startTime = new Date()
	console.log(`Loading config: ${configPath}`)
	const { config, configDir, creativesDir } = loadConfig(configPath)
	console.log("Config validated successfully.")

	const ctx = new PipelineContext(config.adAccountId)

	if (config.existingCampaignId) {
		const campaignRef = config.adSets[0]?.campaignRef
		if (campaignRef) {
			ctx.setRef(campaignRef, config.existingCampaignId)
		}
		console.log(`Using existing campaign: ${config.existingCampaignId}`)
	}

	if (options.dryRun) {
		printDryRun(config)
		return
	}

	try {
		const { adSets: existingAdSets, adCreatives: existingAdCreatives, ads: existingAds } = loadExistingIds(configDir)

		await uploadCreatives(config, creativesDir, client, ctx)

		if (config.campaign) {
			await createCampaign(config.campaign, client, ctx)
		}

		for (const adSet of config.adSets) {
			const existingId = existingAdSets.get(adSet.ref)
			if (existingId) {
				console.log(`\nUsing cached ad set "${adSet.name}" → ${existingId}`)
				ctx.setRef(adSet.ref, existingId)
				ctx.trackCreated({ type: "adSet", ref: adSet.ref, metaId: existingId, name: adSet.name })
			} else {
				await createAdSet(adSet, client, ctx)
			}
		}

		for (const ad of config.ads) {
			const existingAdId = existingAds.get(ad.ref)
			const existingCreativeId = existingAdCreatives.get(`${ad.ref}:creative`)
			if (existingAdId && existingCreativeId) {
				console.log(`\nUsing cached ad "${ad.name}" → ${existingAdId}`)
				ctx.setRef(ad.ref, existingAdId)
				ctx.setRef(`${ad.ref}:creative`, existingCreativeId)
				ctx.trackCreated({ type: "adCreative", ref: `${ad.ref}:creative`, metaId: existingCreativeId, name: `${ad.name} - Creative` })
				ctx.trackCreated({ type: "ad", ref: ad.ref, metaId: existingAdId, name: ad.name })
			} else {
				await createAd(ad, client, ctx)
			}
		}

		const resultPath = writeResult(configDir, ctx)
		try {
			await persistPipelineResult({
				configPath,
				adAccountId: config.adAccountId,
				status: "completed",
				startTime,
				configSnapshot: config,
				ctx,
			})
		} catch {}
		printSummary(ctx, resultPath)
	} catch (error) {
		console.error("\nPipeline failed!")
		try {
			await persistPipelineResult({
				configPath,
				adAccountId: config.adAccountId,
				status: "failed",
				startTime,
				configSnapshot: config,
				errorMessage: error instanceof Error ? error.message : String(error),
				ctx,
			})
		} catch {}
		if (ctx.createdEntities.length > 0) {
			console.error("Partial results written.")
			const resultPath = writeResult(configDir, ctx)
			console.error(`See: ${resultPath}`)
		}
		throw error
	}
}

function printDryRun(config: ReturnType<typeof loadConfig>["config"]): void {
	console.log("\n--- DRY RUN PREVIEW ---\n")
	console.log(`Ad Account: ${config.adAccountId}`)

	if (config.campaign) {
		console.log(`\nCampaign: "${config.campaign.name}"`)
		console.log(`  Objective: ${config.campaign.objective}`)
		console.log(`  Status: ${config.campaign.status}`)
		if (config.campaign.dailyBudget) {
			console.log(`  Daily Budget: $${(config.campaign.dailyBudget / 100).toFixed(2)}`)
		}
	} else {
		console.log(`\nUsing existing campaign: ${config.existingCampaignId}`)
	}

	for (const adSet of config.adSets) {
		console.log(`\nAd Set: "${adSet.name}"`)
		console.log(`  Campaign Ref: ${adSet.campaignRef}`)
		console.log(`  Status: ${adSet.status}`)
		console.log(`  Optimization: ${adSet.optimizationGoal}`)
		if (adSet.dailyBudget) {
			console.log(`  Daily Budget: $${(adSet.dailyBudget / 100).toFixed(2)}`)
		}
		if (adSet.targeting.geoLocations?.countries) {
			console.log(`  Countries: ${adSet.targeting.geoLocations.countries.join(", ")}`)
		}
		if (adSet.targeting.ageMin || adSet.targeting.ageMax) {
			console.log(`  Age: ${adSet.targeting.ageMin ?? "13"}-${adSet.targeting.ageMax ?? "65"}`)
		}
	}

	for (const ad of config.ads) {
		console.log(`\nAd: "${ad.name}"`)
		console.log(`  Ad Set Ref: ${ad.adSetRef}`)
		console.log(`  Creative: ${ad.creative.file}`)
		console.log(`  Page ID: ${ad.creative.pageId}`)
		console.log(`  Primary Texts: ${ad.creative.primaryTexts.length}`)
		console.log(`  Headlines: ${ad.creative.headlines.length}`)
		console.log(`  Landing Page: ${ad.creative.landingPageUrl}`)
		console.log(`  CTA: ${ad.creative.callToAction}`)
	}

	console.log("\n--- END DRY RUN ---")
}

function printSummary(ctx: PipelineContext, resultPath: string): void {
	console.log("\n--- PIPELINE COMPLETE ---\n")
	console.log(`Created ${ctx.createdEntities.length} entities:`)

	const grouped = {
		campaign: ctx.createdEntities.filter((e) => e.type === "campaign"),
		adSet: ctx.createdEntities.filter((e) => e.type === "adSet"),
		adCreative: ctx.createdEntities.filter((e) => e.type === "adCreative"),
		ad: ctx.createdEntities.filter((e) => e.type === "ad"),
		creative: ctx.createdEntities.filter((e) => e.type === "creative"),
	}

	for (const [type, entities] of Object.entries(grouped)) {
		if (entities.length > 0) {
			console.log(`\n  ${type}s:`)
			for (const e of entities) {
				console.log(`    ${e.ref} → ${e.metaId}`)
			}
		}
	}

	console.log(`\nResult file: ${resultPath}`)
}
