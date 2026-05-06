import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { MetaApiClient } from "@/lib/meta-api"
import { PipelineConfig } from "@/lib/pipeline/config-schema"
import { runPipelineFromConfig } from "@/lib/pipeline/executor"
import { registerRef, resolveRef, requireRef, listRefs, unregisterRef } from "@/lib/mcp/refs"

const CHARACTER_LIMIT = 25_000

function truncate(value: unknown): string {
	const json = JSON.stringify(value, null, 2)
	if (json.length <= CHARACTER_LIMIT) return json
	return json.slice(0, CHARACTER_LIMIT) + `\n... [truncated at ${CHARACTER_LIMIT} chars]`
}

function textContent(value: unknown) {
	return { content: [{ type: "text" as const, text: truncate(value) }] }
}

function getClient(extra: { authInfo?: { token?: string } }): MetaApiClient {
	const token = extra.authInfo?.token
	if (!token) throw new Error("Missing bearer token. Pass your Meta access token as Authorization: Bearer <token>.")
	return new MetaApiClient(token)
}

async function resolveIdOrRef(idParam: string | undefined, refParam: string | undefined, label: string): Promise<string> {
	if (idParam) return idParam
	if (refParam) return requireRef(refParam)
	throw new Error(`Either ${label}Id or ${label}Ref must be provided.`)
}

export function registerTools(server: McpServer) {
	server.registerTool(
		"meta_list_pages",
		{
			description: `List all Facebook Pages the token has access to.
Use to discover pageId values needed for ad creatives.
Returns id, name, category per page.`,
			inputSchema: z.object({
				output: z.enum(["json", "markdown"]).optional().default("json"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ output }, extra) => {
			const client = getClient(extra)
			const result = await client.listPages()
			if (output === "markdown") {
				const lines = result.data.map(
					(p) => `- **${p.name}** (id: \`${p.id}\`, category: ${p.category ?? "—"})`,
				)
				return { content: [{ type: "text", text: lines.join("\n") || "No pages found." }] }
			}
			return textContent(result.data)
		},
	)

	server.registerTool(
		"meta_list_campaigns",
		{
			description: `List campaigns in a Meta ad account.
Use to browse existing campaigns or verify creation results.
Returns id, name, status, objective per campaign.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				fields: z.string().optional().default("id,name,status,objective,daily_budget,lifetime_budget"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ adAccountId, fields }, extra) => {
			const client = getClient(extra)
			const result = await client.listCampaigns(adAccountId, fields)
			return textContent(result.data)
		},
	)

	server.registerTool(
		"meta_list_adsets",
		{
			description: `List ad sets in a Meta ad account, optionally filtered to a specific campaign.
Accepts either campaignId (Meta ID) or campaignRef (registered nickname).
Returns id, name, status, campaign_id, daily_budget per ad set.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				campaignId: z.string().optional().describe("Filter to this campaign Meta ID"),
				campaignRef: z.string().optional().describe("Filter to this campaign ref nickname"),
				fields: z.string().optional().default("id,name,status,campaign_id,daily_budget,optimization_goal"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ adAccountId, campaignId, campaignRef, fields }, extra) => {
			const client = getClient(extra)
			const result = await client.listAdSets(adAccountId, fields)
			let adSets = result.data
			const filterCampaignId = campaignId ?? (campaignRef ? await resolveRef(campaignRef) : null)
			if (filterCampaignId) {
				adSets = adSets.filter((s) => s.campaign_id === filterCampaignId)
			}
			return textContent(adSets)
		},
	)

	server.registerTool(
		"meta_get_video_status",
		{
			description: `Get processing status of an uploaded Meta video.
Use to check if a video is ready before creating ad creatives.
Returns video_status (ready/processing/error) and processing_progress.`,
			inputSchema: z.object({
				videoId: z.string().describe("Meta video ID"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ videoId }, extra) => {
			const client = getClient(extra)
			const result = await client.getVideoStatus(videoId)
			return textContent(result)
		},
	)

	server.registerTool(
		"meta_get_video_thumbnails",
		{
			description: `Get available thumbnail URLs for a Meta video.
Use to pick a thumbnail URL when building video ad creatives.
Returns array of thumbnail URIs.`,
			inputSchema: z.object({
				videoId: z.string().describe("Meta video ID"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ videoId }, extra) => {
			const client = getClient(extra)
			const result = await client.getVideoThumbnails(videoId)
			return textContent(result.data)
		},
	)

	server.registerTool(
		"meta_search_geo",
		{
			description: `Search Meta geo-targeting locations (countries, regions, cities).
Use before creating ad sets to find valid location keys for targeting.
Example: query "New York" with type "adcity" to get city key for targeting.`,
			inputSchema: z.object({
				query: z.string().min(1).describe("Search term, e.g. 'California' or 'UK'"),
				type: z.enum(["adgeolocation", "adcity", "adregion", "adcountry"]).optional().default("adgeolocation"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ query, type }, extra) => {
			const client = getClient(extra)
			const result = await client.searchGeo(query, type)
			return textContent(result.data)
		},
	)

	server.registerTool(
		"meta_get_campaign_tree",
		{
			description: `Fetch full structure of a campaign: campaign → ad sets → ads (live Meta data).
Accepts campaignId (Meta ID) or campaignRef (registered nickname).
Use to inspect what was created, verify status, or understand structure before modifications.`,
			inputSchema: z.object({
				campaignId: z.string().optional().describe("Meta campaign ID"),
				campaignRef: z.string().optional().describe("Registered ref nickname for the campaign"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ campaignId, campaignRef }, extra) => {
			const client = getClient(extra)
			const id = await resolveIdOrRef(campaignId, campaignRef, "campaign")
			const result = await client.getCampaignTree(id)
			return textContent(result)
		},
	)

	server.registerTool(
		"meta_lookup_ref",
		{
			description: `Resolve a ref nickname to its Meta ID and metadata.
Use when you have a ref name and need the actual Meta entity ID.
Returns metaId, type, accountId, parentRef, createdAt.`,
			inputSchema: z.object({
				ref: z.string().describe("Ref nickname to resolve"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		async ({ ref }) => {
			const metaId = await resolveRef(ref)
			if (!metaId) {
				return {
					content: [
						{
							type: "text",
							text: `Ref "${ref}" not found. Use meta_list_refs to see all registered refs.`,
						},
					],
				}
			}
			return textContent({ ref, metaId })
		},
	)

	server.registerTool(
		"meta_list_refs",
		{
			description: `List all registered ref nicknames and their Meta IDs.
Use to discover what campaigns, ad sets, and ads have been created and tagged with refs.
Filter by type (campaign/adSet/ad/adCreative/creative), accountId, or parentRef.`,
			inputSchema: z.object({
				type: z.enum(["campaign", "adSet", "adCreative", "ad", "creative"]).optional().describe("Filter by entity type"),
				accountId: z.string().optional().describe("Filter by ad account ID"),
				parentRef: z.string().optional().describe("Filter to children of this ref"),
				since: z.string().optional().describe("ISO date string — only refs created after this date"),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		async ({ type, accountId, parentRef, since }) => {
			const refs = await listRefs({
				type,
				accountId,
				parentRef,
				since: since ? new Date(since) : undefined,
			})
			return textContent(refs)
		},
	)

	server.registerTool(
		"meta_forget_ref",
		{
			description: `Delete a ref nickname from the registry. Does NOT delete the entity on Meta.
Use when a ref is stale (entity was archived/deleted on Meta) or was created in error.`,
			inputSchema: z.object({
				ref: z.string().describe("Ref nickname to remove"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		async ({ ref }) => {
			await unregisterRef(ref)
			return { content: [{ type: "text", text: `Ref "${ref}" removed from registry.` }] }
		},
	)

	server.registerTool(
		"meta_upload_image_from_url",
		{
			description: `Upload an image to Meta from a public URL and get its image_hash.
The image_hash is required when building image-based ad creatives.
Supports jpg, jpeg, png, gif, webp. Optionally tag with a ref for later lookup.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				url: z.string().url().describe("Public URL of the image to upload"),
				ref: z.string().optional().describe("Optional ref nickname for this asset"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ adAccountId, url, ref }, extra) => {
			const client = getClient(extra)
			const result = await client.uploadImageFromUrl(adAccountId, url)
			const imageEntry = Object.values(result.images)[0]
			if (!imageEntry?.hash) throw new Error("Upload succeeded but no image hash returned")
			if (ref) await registerRef(ref, imageEntry.hash, "creative", adAccountId)
			return textContent({ hash: imageEntry.hash, ref: ref ?? null })
		},
	)

	server.registerTool(
		"meta_upload_video_from_url",
		{
			description: `Upload a video to Meta from a public URL and get its video ID.
After upload, poll meta_get_video_status until status is 'ready' before creating creatives.
Supports mp4, mov. Optionally tag with a ref for later lookup.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				url: z.string().url().describe("Public URL of the video to upload"),
				ref: z.string().optional().describe("Optional ref nickname for this asset"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ adAccountId, url, ref }, extra) => {
			const client = getClient(extra)
			const result = await client.uploadVideoFromUrl(adAccountId, url)
			if (ref) await registerRef(ref, result.id, "creative", adAccountId)
			return textContent({ videoId: result.id, ref: ref ?? null })
		},
	)

	server.registerTool(
		"meta_create_campaign",
		{
			description: `Create a Meta ad campaign. All campaigns are created PAUSED by default.
Use ref to register a nickname for later use in meta_create_adset and meta_get_campaign_tree.
Returns metaId of the new campaign.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				name: z.string().min(1),
				objective: z.enum([
					"OUTCOME_SALES",
					"OUTCOME_LEADS",
					"OUTCOME_TRAFFIC",
					"OUTCOME_AWARENESS",
					"OUTCOME_ENGAGEMENT",
					"OUTCOME_APP_PROMOTION",
				]),
				status: z.enum(["PAUSED", "ACTIVE"]).optional().default("PAUSED"),
				specialAdCategories: z.array(z.string()).optional().default([]),
				bidStrategy: z
					.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS"])
					.optional(),
				dailyBudget: z.number().int().positive().optional().describe("Budget in cents, e.g. 5000 = $50"),
				campaignBudgetOptimization: z.boolean().optional().default(false),
				ref: z.string().optional().describe("Nickname for this campaign, used in child creates"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ adAccountId, ref, ...params }, extra) => {
			const client = getClient(extra)
			const result = await client.createCampaign(adAccountId, {
				name: params.name,
				objective: params.objective,
				status: params.status,
				special_ad_categories: params.specialAdCategories,
				...(params.bidStrategy && { bid_strategy: params.bidStrategy }),
				...(params.dailyBudget && { daily_budget: params.dailyBudget }),
				...(params.campaignBudgetOptimization && { campaign_budget_optimization: true }),
			})
			if (ref) await registerRef(ref, result.id, "campaign", adAccountId)
			return textContent({ metaId: result.id, ref: ref ?? null })
		},
	)

	server.registerTool(
		"meta_create_adset",
		{
			description: `Create a Meta ad set inside an existing campaign.
Accepts campaignId (Meta ID) or campaignRef (ref nickname).
Always includes 7-day click / 1-day view attribution. Defaults to iOS + Instagram targeting.
Returns metaId of the new ad set.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				name: z.string().min(1),
				campaignId: z.string().optional().describe("Meta campaign ID"),
				campaignRef: z.string().optional().describe("Ref nickname of the campaign"),
				status: z.enum(["PAUSED", "ACTIVE"]).optional().default("PAUSED"),
				dailyBudget: z.number().int().positive().optional().describe("Budget in cents"),
				lifetimeBudget: z.number().int().positive().optional().describe("Budget in cents"),
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
				billingEvent: z.enum(["IMPRESSIONS", "LINK_CLICKS", "POST_ENGAGEMENT", "VIDEO_VIEWS"]).optional().default("IMPRESSIONS"),
				countries: z.array(z.string()).optional().default(["US"]).describe("ISO country codes"),
				ageMin: z.number().int().min(13).max(65).optional(),
				ageMax: z.number().int().min(13).max(65).optional(),
				pixelId: z.string().optional(),
				pageId: z.string().optional(),
				ref: z.string().optional().describe("Nickname for this ad set"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ adAccountId, ref, campaignId, campaignRef, countries, ageMin, ageMax, pixelId, pageId, ...params }, extra) => {
			const client = getClient(extra)
			const resolvedCampaignId = await resolveIdOrRef(campaignId, campaignRef, "campaign")
			const result = await client.createAdSet(adAccountId, {
				name: params.name,
				campaign_id: resolvedCampaignId,
				status: params.status,
				...(params.dailyBudget && { daily_budget: params.dailyBudget }),
				...(params.lifetimeBudget && { lifetime_budget: params.lifetimeBudget }),
				optimization_goal: params.optimizationGoal,
				billing_event: params.billingEvent,
				targeting: {
					geo_locations: { countries: countries ?? ["US"] },
					...(ageMin && { age_min: ageMin }),
					...(ageMax && { age_max: ageMax }),
					publisher_platforms: ["instagram"],
					instagram_positions: ["stream", "story", "reels"],
					user_os: ["iOS"],
				},
				...(pixelId || pageId
					? { promoted_object: { ...(pixelId && { pixel_id: pixelId }), ...(pageId && { page_id: pageId }) } }
					: {}),
				attribution_spec: [
					{ event_type: "CLICK_THROUGH", window_days: 7 },
					{ event_type: "VIEW_THROUGH", window_days: 1 },
				],
			})
			if (ref) await registerRef(ref, result.id, "adSet", adAccountId, campaignRef)
			return textContent({ metaId: result.id, ref: ref ?? null })
		},
	)

	server.registerTool(
		"meta_create_ad",
		{
			description: `Create a Meta ad linking an ad creative to an ad set.
Accepts adSetId (Meta ID) or adSetRef (ref nickname). Requires creativeId (Meta creative ID).
All ads are created PAUSED by default. Returns metaId.`,
			inputSchema: z.object({
				adAccountId: z.string().describe("Ad account ID in act_XXXX format"),
				name: z.string().min(1),
				adSetId: z.string().optional().describe("Meta ad set ID"),
				adSetRef: z.string().optional().describe("Ref nickname of the ad set"),
				creativeId: z.string().describe("Meta ad creative ID"),
				status: z.enum(["PAUSED", "ACTIVE"]).optional().default("PAUSED"),
				ref: z.string().optional().describe("Nickname for this ad"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ adAccountId, ref, adSetId, adSetRef, creativeId, ...params }, extra) => {
			const client = getClient(extra)
			const resolvedAdSetId = await resolveIdOrRef(adSetId, adSetRef, "adSet")
			const result = await client.createAd(adAccountId, {
				name: params.name,
				adset_id: resolvedAdSetId,
				creative: { creative_id: creativeId },
				status: params.status,
			})
			if (ref) await registerRef(ref, result.id, "ad", adAccountId, adSetRef)
			return textContent({ metaId: result.id, ref: ref ?? null })
		},
	)

	server.registerTool(
		"meta_run_pipeline",
		{
			description: `Run the full Meta campaign pipeline from an inline JSON config.
Creates campaign → ad sets → ads in one call. All entities start PAUSED.
Creative files must use fileUrl (public URL), not local file paths.
With dryRun=true, validates config and previews without creating anything.
Returns list of all created entities with their Meta IDs.

Config shape:
{
  version: 1,
  adAccountId: "act_XXX",
  campaign?: { ref, name, objective, ... },
  existingCampaignId?: "123",
  adSets: [{ ref, name, campaignRef, optimizationGoal, targeting, ... }],
  ads: [{ ref, name, adSetRef, creative: { pageId, fileUrl, primaryTexts, headlines, ... } }]
}`,
			inputSchema: z.object({
				config: PipelineConfig.describe("Full pipeline config object"),
				dryRun: z.boolean().optional().default(false).describe("Preview only — no Meta API calls"),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
		},
		async ({ config, dryRun }, extra) => {
			const client = getClient(extra)
			const result = await runPipelineFromConfig(config, client, { dryRun })
			if (dryRun) {
				return { content: [{ type: "text", text: "Dry run complete. Config is valid. No entities created." }] }
			}
			for (const entity of result.created) {
				if (entity.type !== "creative") {
					await registerRef(entity.ref, entity.metaId, entity.type, config.adAccountId)
				}
			}
			return textContent(result.created)
		},
	)
}
