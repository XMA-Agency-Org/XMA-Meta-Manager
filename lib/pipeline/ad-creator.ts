import * as path from "node:path"
import type { MetaApiClient } from "@/lib/meta-api"
import type { AdCreativeCreateParams, AssetFeedSpec, ObjectStorySpec } from "@/lib/meta-api-types"
import type { ConfigAd } from "./config-schema"
import type { PipelineContext } from "./context"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"])

function isImageFile(filename: string): boolean {
	return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function isCarouselAd(ad: ConfigAd): boolean {
	return Array.isArray(ad.creative.slides) && ad.creative.slides.length >= 2
}

function buildCarouselObjectStorySpec(
	ad: ConfigAd,
	ctx: PipelineContext,
): ObjectStorySpec {
	const creative = ad.creative
	const slides = creative.slides!

	const childAttachments = slides.map((slide, index) => ({
		image_hash: ctx.resolveRef(`file:${slide.file}`),
		link: creative.landingPageUrl,
		name: slide.headline ?? creative.headlines[index] ?? creative.headlines[0],
		call_to_action: {
			type: creative.callToAction as "SHOP_NOW",
			value: { link: creative.landingPageUrl },
		},
	}))

	return {
		page_id: creative.pageId,
		...(creative.instagramActorId && { instagram_actor_id: creative.instagramActorId }),
		link_data: {
			link: creative.landingPageUrl,
			message: creative.primaryTexts[0],
			child_attachments: childAttachments,
			multi_share_end_card: false,
			call_to_action: {
				type: creative.callToAction as "SHOP_NOW",
				value: { link: creative.landingPageUrl },
			},
		},
	}
}

function buildSingleObjectStorySpec(
	ad: ConfigAd,
	assetId: string,
	thumbnailUrl?: string,
): ObjectStorySpec {
	const creative = ad.creative

	const spec: ObjectStorySpec = {
		page_id: creative.pageId,
		...(creative.instagramActorId && { instagram_actor_id: creative.instagramActorId }),
	}

	const ctaValue = {
		link: creative.landingPageUrl,
		...(creative.leadFormId && { lead_gen_form_id: creative.leadFormId }),
	}

	if (isImageFile(creative.file!)) {
		spec.link_data = {
			link: creative.landingPageUrl,
			message: creative.primaryTexts[0],
			name: creative.headlines[0],
			image_hash: assetId,
			...(creative.description && { description: creative.description }),
			call_to_action: {
				type: creative.callToAction as "SHOP_NOW",
				value: ctaValue,
			},
		}
	} else {
		spec.video_data = {
			video_id: assetId,
			message: creative.primaryTexts[0],
			title: creative.headlines[0],
			...(creative.description && { link_description: creative.description }),
			...(thumbnailUrl && { image_url: thumbnailUrl }),
			call_to_action: {
				type: creative.callToAction as "SHOP_NOW",
				value: ctaValue,
			},
		}
	}

	return spec
}

function buildCarouselAssetFeedSpec(
	ad: ConfigAd,
): AssetFeedSpec | undefined {
	const creative = ad.creative
	const hasMultipleTexts = creative.primaryTexts.length > 1

	if (!hasMultipleTexts) return undefined

	return {
		optimization_type: "DEGREES_OF_FREEDOM",
		bodies: creative.primaryTexts.map((text) => ({ text })),
		link_urls: [{ website_url: creative.landingPageUrl }],
		call_to_action_types: [creative.callToAction as "SHOP_NOW"],
		ad_formats: ["CAROUSEL_IMAGE"],
	}
}

function buildSingleAssetFeedSpec(
	ad: ConfigAd,
	assetId: string,
	thumbnailUrl?: string,
): AssetFeedSpec | undefined {
	const creative = ad.creative
	const hasMultipleTexts = creative.primaryTexts.length > 1
	const hasMultipleHeadlines = creative.headlines.length > 1

	if (!hasMultipleTexts && !hasMultipleHeadlines) return undefined

	const isImage = isImageFile(creative.file!)
	const adFormat = isImage ? "SINGLE_IMAGE" : "SINGLE_VIDEO"

	const ctaSpec = creative.leadFormId
		? {
				call_to_actions: [
					{
						type: creative.callToAction as "SIGN_UP",
						value: {
							link: creative.landingPageUrl,
							lead_gen_form_id: creative.leadFormId,
						},
					},
				],
			}
		: { call_to_action_types: [creative.callToAction as "SHOP_NOW"] }

	return {
		optimization_type: "DEGREES_OF_FREEDOM",
		...(hasMultipleTexts && {
			bodies: creative.primaryTexts.map((text) => ({ text })),
		}),
		...(hasMultipleHeadlines && {
			titles: creative.headlines.map((text) => ({ text })),
		}),
		link_urls: [{ website_url: creative.landingPageUrl }],
		...ctaSpec,
		ad_formats: [adFormat],
		...(isImage
			? { images: [{ hash: assetId }] }
			: { videos: [{ video_id: assetId, ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }) }] }),
	}
}

export async function createAd(
	ad: ConfigAd,
	client: MetaApiClient,
	ctx: PipelineContext,
): Promise<void> {
	console.log(`\nCreating ad "${ad.name}"...`)

	const adSetId = ctx.resolveRef(ad.adSetRef)

	let objectStorySpec: ObjectStorySpec
	let assetFeedSpec: AssetFeedSpec | undefined

	if (isCarouselAd(ad)) {
		objectStorySpec = buildCarouselObjectStorySpec(ad, ctx)
		assetFeedSpec = buildCarouselAssetFeedSpec(ad)
	} else {
		const assetId = ctx.resolveRef(`file:${ad.creative.file}`)

		let thumbnailUrl: string | undefined
		if (!isImageFile(ad.creative.file!)) {
			const thumbnails = await client.getVideoThumbnails(assetId)
			thumbnailUrl = thumbnails.data?.[0]?.uri
		}

		objectStorySpec = buildSingleObjectStorySpec(ad, assetId, thumbnailUrl)

		const hasMultipleVariations =
			ad.creative.primaryTexts.length > 1 || ad.creative.headlines.length > 1
		assetFeedSpec = hasMultipleVariations
			? buildSingleAssetFeedSpec(ad, assetId, thumbnailUrl)
			: undefined
	}

	const creativeParams: AdCreativeCreateParams = {
		name: `${ad.name} - Creative`,
		object_story_spec: objectStorySpec,
		...(assetFeedSpec && { asset_feed_spec: assetFeedSpec }),
		...(ad.creative.urlTags && { url_tags: ad.creative.urlTags }),
	}

	const creativeResult = await client.createAdCreative(ctx.adAccountId, creativeParams)

	ctx.setRef(`${ad.ref}:creative`, creativeResult.id)
	ctx.trackCreated({
		type: "adCreative",
		ref: `${ad.ref}:creative`,
		metaId: creativeResult.id,
		name: `${ad.name} - Creative`,
	})

	const adResult = await client.createAd(ctx.adAccountId, {
		name: ad.name,
		adset_id: adSetId,
		creative: { creative_id: creativeResult.id },
		status: ad.status,
	})

	ctx.setRef(ad.ref, adResult.id)
	ctx.trackCreated({
		type: "ad",
		ref: ad.ref,
		metaId: adResult.id,
		name: ad.name,
	})
}
