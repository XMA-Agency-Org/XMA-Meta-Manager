import * as fs from "node:fs"
import * as path from "node:path"
import { parse as parseYaml } from "yaml"
import { PipelineConfig } from "./config-schema"

export interface LoadedConfig {
	config: PipelineConfig
	configDir: string
	creativesDir: string
}

export function loadConfig(configPath: string): LoadedConfig {
	const absolutePath = path.resolve(configPath)

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Config file not found: ${absolutePath}`)
	}

	const raw = fs.readFileSync(absolutePath, "utf-8")
	const parsed = parseYaml(raw)
	const config = PipelineConfig.parse(parsed)

	const configDir = path.dirname(absolutePath)
	const creativesDir = path.join(configDir, "creatives")

	validateCreativeFiles(config, creativesDir)
	validateRefChains(config)

	return { config, configDir, creativesDir }
}

function validateCreativeFiles(config: PipelineConfig, creativesDir: string): void {
	const missingFiles: string[] = []

	for (const ad of config.ads) {
		if (ad.creative.file) {
			const filePath = path.join(creativesDir, ad.creative.file)
			if (!fs.existsSync(filePath)) {
				missingFiles.push(ad.creative.file)
			}
		}

		if (ad.creative.slides) {
			for (const slide of ad.creative.slides) {
				const filePath = path.join(creativesDir, slide.file)
				if (!fs.existsSync(filePath)) {
					missingFiles.push(slide.file)
				}
			}
		}
	}

	if (missingFiles.length > 0) {
		throw new Error(
			`Missing creative files in ${creativesDir}:\n${missingFiles.map((f) => `  - ${f}`).join("\n")}`,
		)
	}
}

function validateRefChains(config: PipelineConfig): void {
	const errors: string[] = []

	const campaignRef = config.campaign?.ref
	const adSetRefs = new Set(config.adSets.map((as) => as.ref))

	for (const adSet of config.adSets) {
		if (campaignRef && adSet.campaignRef !== campaignRef) {
			errors.push(`Ad set "${adSet.ref}" references campaign "${adSet.campaignRef}" but campaign ref is "${campaignRef}"`)
		}
		if (!campaignRef && !config.existingCampaignId) {
			errors.push(`Ad set "${adSet.ref}" has campaignRef but no campaign or existingCampaignId defined`)
		}
	}

	for (const ad of config.ads) {
		if (!adSetRefs.has(ad.adSetRef)) {
			errors.push(`Ad "${ad.ref}" references ad set "${ad.adSetRef}" which does not exist`)
		}
	}

	const allRefs = [
		...(campaignRef ? [campaignRef] : []),
		...config.adSets.map((as) => as.ref),
		...config.ads.map((a) => a.ref),
	]
	const duplicates = allRefs.filter((ref, i) => allRefs.indexOf(ref) !== i)
	if (duplicates.length > 0) {
		errors.push(`Duplicate refs: ${[...new Set(duplicates)].join(", ")}`)
	}

	if (errors.length > 0) {
		throw new Error(`Config validation errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`)
	}
}
