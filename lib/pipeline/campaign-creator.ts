import type { MetaApiClient } from "@/lib/meta-api"
import type { CampaignCreateParams } from "@/lib/meta-api-types"
import type { ConfigCampaign } from "./config-schema"
import type { PipelineContext } from "./context"

export async function createCampaign(
	campaign: ConfigCampaign,
	client: MetaApiClient,
	ctx: PipelineContext,
): Promise<void> {
	console.log(`\nCreating campaign "${campaign.name}"...`)

	const params: CampaignCreateParams = {
		name: campaign.name,
		objective: campaign.objective,
		status: campaign.status,
		special_ad_categories: campaign.specialAdCategories,
		...(campaign.bidStrategy && { bid_strategy: campaign.bidStrategy }),
		...(campaign.dailyBudget && { daily_budget: campaign.dailyBudget }),
		...(campaign.campaignBudgetOptimization && { campaign_budget_optimization: true }),
	}

	const result = await client.createCampaign(ctx.adAccountId, params)

	ctx.setRef(campaign.ref, result.id)
	ctx.trackCreated({
		type: "campaign",
		ref: campaign.ref,
		metaId: result.id,
		name: campaign.name,
	})
}
