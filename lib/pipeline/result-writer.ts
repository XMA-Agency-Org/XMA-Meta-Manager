import * as fs from "node:fs"
import * as path from "node:path"
import { stringify as stringifyYaml } from "yaml"
import type { PipelineContext } from "./context"

export function writeResult(configDir: string, ctx: PipelineContext): string {
	const resultPath = path.join(configDir, "_result.yaml")

	const campaignEntities = ctx.createdEntities.filter((e) => e.type === "campaign")
	const adSetEntities = ctx.createdEntities.filter((e) => e.type === "adSet")
	const adCreativeEntities = ctx.createdEntities.filter((e) => e.type === "adCreative")
	const adEntities = ctx.createdEntities.filter((e) => e.type === "ad")
	const creativeEntities = ctx.createdEntities.filter((e) => e.type === "creative")

	const result: Record<string, unknown> = {
		executedAt: new Date().toISOString(),
		adAccountId: ctx.adAccountId,
	}

	if (campaignEntities.length > 0) {
		const campaign = campaignEntities[0]
		result.campaign = {
			ref: campaign.ref,
			metaId: campaign.metaId,
			adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${ctx.adAccountId.replace("act_", "")}&campaign_ids=${campaign.metaId}`,
		}
	}

	if (adSetEntities.length > 0) {
		result.adSets = adSetEntities.map((e) => ({
			ref: e.ref,
			metaId: e.metaId,
		}))
	}

	if (adCreativeEntities.length > 0) {
		result.adCreatives = adCreativeEntities.map((e) => ({
			ref: e.ref,
			metaId: e.metaId,
		}))
	}

	if (adEntities.length > 0) {
		result.ads = adEntities.map((e) => ({
			ref: e.ref,
			metaId: e.metaId,
		}))
	}

	if (creativeEntities.length > 0) {
		result.creatives = creativeEntities.map((e) => ({
			file: e.name,
			assetId: e.metaId,
		}))
	}

	fs.writeFileSync(resultPath, stringifyYaml(result), "utf-8")
	return resultPath
}
