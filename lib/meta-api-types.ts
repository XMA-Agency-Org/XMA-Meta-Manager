import { z } from "zod/v4"

export const CampaignObjective = z.enum([
	"OUTCOME_SALES",
	"OUTCOME_LEADS",
	"OUTCOME_TRAFFIC",
	"OUTCOME_AWARENESS",
	"OUTCOME_ENGAGEMENT",
	"OUTCOME_APP_PROMOTION",
])

export const CampaignStatus = z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"])

export const BidStrategy = z.enum([
	"LOWEST_COST_WITHOUT_CAP",
	"LOWEST_COST_WITH_BID_CAP",
	"COST_CAP",
	"LOWEST_COST_WITH_MIN_ROAS",
])

export const BillingEvent = z.enum([
	"IMPRESSIONS",
	"LINK_CLICKS",
	"POST_ENGAGEMENT",
	"VIDEO_VIEWS",
])

export const OptimizationGoal = z.enum([
	"OFFSITE_CONVERSIONS",
	"LINK_CLICKS",
	"IMPRESSIONS",
	"REACH",
	"LANDING_PAGE_VIEWS",
	"LEAD_GENERATION",
	"VALUE",
	"CONVERSATIONS",
	"APP_INSTALLS",
	"VIDEO_VIEWS",
	"THRUPLAY",
	"ENGAGED_USERS",
])

export const CallToAction = z.enum([
	"SHOP_NOW",
	"LEARN_MORE",
	"SIGN_UP",
	"SUBSCRIBE",
	"CONTACT_US",
	"GET_OFFER",
	"BOOK_TRAVEL",
	"DOWNLOAD",
	"APPLY_NOW",
	"ORDER_NOW",
	"BUY_NOW",
	"GET_QUOTE",
	"WATCH_MORE",
	"SEND_MESSAGE",
	"NO_BUTTON",
])

export const CampaignCreateParams = z.object({
	name: z.string(),
	objective: CampaignObjective,
	status: CampaignStatus.default("PAUSED"),
	special_ad_categories: z.array(z.string()).default([]),
	daily_budget: z.number().int().positive().optional(),
	bid_strategy: BidStrategy.optional(),
})

export type CampaignCreateParams = z.infer<typeof CampaignCreateParams>

export const TargetingSpec = z.object({
	geo_locations: z
		.object({
			countries: z.array(z.string()).optional(),
			regions: z.array(z.object({ key: z.string() })).optional(),
			cities: z
				.array(z.object({ key: z.string(), radius: z.number().optional(), distance_unit: z.string().optional() }))
				.optional(),
		})
		.optional(),
	age_min: z.number().int().min(13).max(65).optional(),
	age_max: z.number().int().min(13).max(65).optional(),
	genders: z.array(z.number().int().min(0).max(2)).optional(),
	custom_audiences: z.array(z.object({ id: z.string() })).optional(),
	excluded_custom_audiences: z.array(z.object({ id: z.string() })).optional(),
	flexible_spec: z.array(z.record(z.string(), z.unknown())).optional(),
	publisher_platforms: z.array(z.string()).optional(),
	facebook_positions: z.array(z.string()).optional(),
	instagram_positions: z.array(z.string()).optional(),
})

export type TargetingSpec = z.infer<typeof TargetingSpec>

export const AdSetCreateParams = z.object({
	name: z.string(),
	campaign_id: z.string(),
	status: CampaignStatus.default("PAUSED"),
	daily_budget: z.number().int().positive().optional(),
	lifetime_budget: z.number().int().positive().optional(),
	start_time: z.string().optional(),
	end_time: z.string().optional(),
	targeting: TargetingSpec,
	billing_event: BillingEvent.default("IMPRESSIONS"),
	optimization_goal: OptimizationGoal,
	promoted_object: z
		.object({
			pixel_id: z.string(),
			custom_event_type: z.string().optional(),
		})
		.optional(),
	is_dynamic_creative: z.boolean().optional(),
	bid_amount: z.number().int().positive().optional(),
	attribution_spec: z
		.array(
			z.object({
				event_type: z.string(),
				window_days: z.number().int(),
			}),
		)
		.optional(),
})

export type AdSetCreateParams = z.infer<typeof AdSetCreateParams>

export const ChildAttachment = z.object({
	image_hash: z.string(),
	link: z.string().url(),
	name: z.string().optional(),
	call_to_action: z
		.object({
			type: CallToAction,
			value: z.object({ link: z.string().url() }).optional(),
		})
		.optional(),
})

export const LinkData = z.object({
	link: z.string().url(),
	message: z.string().optional(),
	name: z.string().optional(),
	description: z.string().optional(),
	caption: z.string().optional(),
	image_hash: z.string().optional(),
	call_to_action: z
		.object({
			type: CallToAction,
			value: z.object({ link: z.string().url() }).optional(),
		})
		.optional(),
	child_attachments: z.array(ChildAttachment).optional(),
	multi_share_end_card: z.boolean().optional(),
})

export const VideoData = z.object({
	video_id: z.string(),
	message: z.string().optional(),
	title: z.string().optional(),
	link_description: z.string().optional(),
	call_to_action: z
		.object({
			type: CallToAction,
			value: z.object({ link: z.string().url() }).optional(),
		})
		.optional(),
	image_hash: z.string().optional(),
	image_url: z.string().optional(),
})

export const ObjectStorySpec = z.object({
	page_id: z.string(),
	instagram_actor_id: z.string().optional(),
	link_data: LinkData.optional(),
	video_data: VideoData.optional(),
})

export const AssetFeedSpec = z.object({
	bodies: z.array(z.object({ text: z.string() })).optional(),
	titles: z.array(z.object({ text: z.string() })).optional(),
	descriptions: z.array(z.object({ text: z.string() })).optional(),
	link_urls: z.array(z.object({ website_url: z.string().url() })).optional(),
	call_to_action_types: z.array(CallToAction).optional(),
	ad_formats: z.array(z.string()).optional(),
	videos: z.array(z.object({ video_id: z.string(), thumbnail_url: z.string().optional(), thumbnail_hash: z.string().optional() })).optional(),
	images: z.array(z.object({ hash: z.string() })).optional(),
})

export const AdCreativeCreateParams = z.object({
	name: z.string(),
	object_story_spec: ObjectStorySpec,
	asset_feed_spec: AssetFeedSpec.optional(),
	url_tags: z.string().optional(),
})

export type AdCreativeCreateParams = z.infer<typeof AdCreativeCreateParams>

export const AdCreateParams = z.object({
	name: z.string(),
	adset_id: z.string(),
	creative: z.object({ creative_id: z.string() }),
	status: CampaignStatus.default("PAUSED"),
})

export type AdCreateParams = z.infer<typeof AdCreateParams>

export const MetaApiResponse = z.object({
	id: z.string(),
})

export type MetaApiResponse = z.infer<typeof MetaApiResponse>

export const MetaApiErrorDetail = z.object({
	message: z.string(),
	type: z.string().optional(),
	code: z.number().optional(),
	error_subcode: z.number().optional(),
	fbtrace_id: z.string().optional(),
})

export const MetaApiErrorResponse = z.object({
	error: MetaApiErrorDetail,
})

export type MetaApiErrorResponse = z.infer<typeof MetaApiErrorResponse>

export const ImageUploadResponse = z.object({
	images: z.record(
		z.string(),
		z.object({
			hash: z.string(),
			url: z.string().optional(),
		}),
	),
})

export type ImageUploadResponse = z.infer<typeof ImageUploadResponse>

export const VideoUploadResponse = z.object({
	id: z.string(),
})

export type VideoUploadResponse = z.infer<typeof VideoUploadResponse>
