import { z } from "zod/v4"

export const ConfigCampaign = z.object({
	ref: z.string(),
	name: z.string(),
	objective: z.enum([
		"OUTCOME_SALES",
		"OUTCOME_LEADS",
		"OUTCOME_TRAFFIC",
		"OUTCOME_AWARENESS",
		"OUTCOME_ENGAGEMENT",
		"OUTCOME_APP_PROMOTION",
	]),
	status: z.enum(["PAUSED", "ACTIVE"]).default("PAUSED"),
	specialAdCategories: z.array(z.string()).default([]),
	bidStrategy: z
		.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS"])
		.optional(),
	dailyBudget: z.number().int().positive().optional(),
})

export type ConfigCampaign = z.infer<typeof ConfigCampaign>

export const ConfigTargeting = z.object({
	geoLocations: z
		.object({
			countries: z.array(z.string()).optional(),
			regions: z.array(z.object({ key: z.string() })).optional(),
			cities: z
				.array(z.object({ key: z.string(), radius: z.number().optional(), distanceUnit: z.string().optional() }))
				.optional(),
		})
		.optional(),
	ageMin: z.number().int().min(13).max(65).optional(),
	ageMax: z.number().int().min(13).max(65).optional(),
	genders: z.array(z.number().int().min(0).max(2)).optional(),
	customAudiences: z.array(z.string()).default([]),
	excludedCustomAudiences: z.array(z.string()).default([]),
	flexibleSpec: z.array(z.record(z.string(), z.unknown())).optional(),
	advantageAudience: z.boolean().default(false),
})

export type ConfigTargeting = z.infer<typeof ConfigTargeting>

export const ConfigAdSet = z.object({
	ref: z.string(),
	name: z.string(),
	campaignRef: z.string(),
	status: z.enum(["PAUSED", "ACTIVE"]).default("PAUSED"),
	dailyBudget: z.number().int().positive().optional(),
	lifetimeBudget: z.number().int().positive().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	promotedObject: z
		.object({
			pixelId: z.string(),
			customEventType: z.string().optional(),
		})
		.optional(),
	targeting: ConfigTargeting,
	placements: z.union([z.literal("automatic"), z.literal("manual")]).default("automatic"),
	manualPlacements: z
		.object({
			platforms: z.array(z.string()).optional(),
			facebookPositions: z.array(z.string()).optional(),
			instagramPositions: z.array(z.string()).optional(),
		})
		.optional(),
	billingEvent: z
		.enum(["IMPRESSIONS", "LINK_CLICKS", "POST_ENGAGEMENT", "VIDEO_VIEWS"])
		.default("IMPRESSIONS"),
	optimizationGoal: z.enum([
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
	]),
	attributionSpec: z
		.array(z.object({ eventType: z.string(), windowDays: z.number().int() }))
		.optional(),
})

export type ConfigAdSet = z.infer<typeof ConfigAdSet>

export const ConfigSlide = z.object({
	file: z.string(),
	headline: z.string().optional(),
})

export type ConfigSlide = z.infer<typeof ConfigSlide>

export const ConfigAdCreative = z
	.object({
		pageId: z.string(),
		instagramActorId: z.string().optional(),
		file: z.string().optional(),
		slides: z.array(ConfigSlide).min(2).optional(),
		primaryTexts: z.array(z.string()).min(1),
		headlines: z.array(z.string()).min(1),
		description: z.string().optional(),
		callToAction: z.string().default("LEARN_MORE"),
		landingPageUrl: z.string().url(),
		urlTags: z.string().optional(),
	})
	.refine((data) => data.file || data.slides, {
		message: "Either 'file' (single creative) or 'slides' (carousel) must be provided",
	})
	.refine((data) => !(data.file && data.slides), {
		message: "Cannot provide both 'file' and 'slides' — use 'slides' for carousel ads",
	})

export type ConfigAdCreative = z.infer<typeof ConfigAdCreative>

export const ConfigAd = z.object({
	ref: z.string(),
	name: z.string(),
	adSetRef: z.string(),
	status: z.enum(["PAUSED", "ACTIVE"]).default("PAUSED"),
	creative: ConfigAdCreative,
})

export type ConfigAd = z.infer<typeof ConfigAd>

export const PipelineConfig = z
	.object({
		version: z.literal(1),
		adAccountId: z.string().startsWith("act_"),
		campaign: ConfigCampaign.optional(),
		existingCampaignId: z.string().optional(),
		adSets: z.array(ConfigAdSet).min(1),
		ads: z.array(ConfigAd).min(1),
	})
	.refine((data) => data.campaign || data.existingCampaignId, {
		message: "Either 'campaign' or 'existingCampaignId' must be provided",
	})
	.refine((data) => !(data.campaign && data.existingCampaignId), {
		message: "Cannot provide both 'campaign' and 'existingCampaignId'",
	})

export type PipelineConfig = z.infer<typeof PipelineConfig>
