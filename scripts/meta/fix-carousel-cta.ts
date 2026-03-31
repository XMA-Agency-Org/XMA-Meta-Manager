import { MetaApiClient } from "@/lib/meta-api"
import { loadConfig } from "@/lib/pipeline/config-loader"
import { PipelineContext } from "@/lib/pipeline/context"
import yaml from "yaml"
import * as fs from "node:fs"

const configPath = "campaigns/novocare/novobaby-ads/config.yaml"
const resultPath = "campaigns/novocare/novobaby-ads/_result.yaml"

const token = process.env.META_APP_TOKEN!
const client = new MetaApiClient(token)

const { config } = loadConfig(configPath)
const resultYaml = yaml.parse(fs.readFileSync(resultPath, "utf-8"))

const ctx = new PipelineContext(config.adAccountId)

for (const asset of resultYaml.creatives ?? []) {
	ctx.setRef(`file:${asset.file}`, asset.assetId)
}

const carouselAdRefs = [
	"post_09_carousel_full_line",
	"post_09v2_carousel_full_line",
	"post_11_carousel_shampoo",
	"post_12_carousel_wipes",
]

const adIdMap: Record<string, string> = {}
for (const ad of resultYaml.ads ?? []) {
	adIdMap[ad.ref] = ad.metaId
}

for (const ref of carouselAdRefs) {
	const ad = config.ads.find((a) => a.ref === ref)
	if (!ad) {
		console.log(`Ad ${ref} not found in config, skipping`)
		continue
	}

	const adId = adIdMap[ref]
	console.log(`\nFixing carousel CTA for "${ad.name}"...`)

	const slides = ad.creative.slides!
	const childAttachments = slides.map((slide, index) => ({
		image_hash: ctx.resolveRef(`file:${slide.file}`),
		link: ad.creative.landingPageUrl,
		name: slide.headline ?? ad.creative.headlines[index] ?? ad.creative.headlines[0],
		call_to_action: {
			type: ad.creative.callToAction,
			value: { link: ad.creative.landingPageUrl },
		},
	}))

	const objectStorySpec = {
		page_id: ad.creative.pageId,
		link_data: {
			link: ad.creative.landingPageUrl,
			message: ad.creative.primaryTexts[0],
			child_attachments: childAttachments,
			multi_share_end_card: false,
			call_to_action: {
				type: ad.creative.callToAction,
				value: { link: ad.creative.landingPageUrl },
			},
		},
	}

	const hasMultipleTexts = ad.creative.primaryTexts.length > 1
	const assetFeedSpec = hasMultipleTexts
		? {
				optimization_type: "DEGREES_OF_FREEDOM",
				bodies: ad.creative.primaryTexts.map((text: string) => ({ text })),
				link_urls: [{ website_url: ad.creative.landingPageUrl }],
				call_to_action_types: [ad.creative.callToAction],
				ad_formats: ["CAROUSEL_IMAGE"],
			}
		: undefined

	const creativeParams = {
		name: `${ad.name} - Creative v2`,
		object_story_spec: objectStorySpec,
		...(assetFeedSpec && { asset_feed_spec: assetFeedSpec }),
		...(ad.creative.urlTags && { url_tags: ad.creative.urlTags }),
	}

	const newCreative = await client.createAdCreative(config.adAccountId, creativeParams as any)
	console.log(`  ✓ New creative: ${newCreative.id}`)
	console.log(`  → Update ad ${adId} with: creative_id = ${newCreative.id}`)
}
