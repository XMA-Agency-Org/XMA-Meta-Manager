import type { MetaApiClient } from "@/lib/meta-api"
import type { AdSetCreateParams, TargetingSpec } from "@/lib/meta-api-types"
import type { ConfigAdSet, ConfigTargeting } from "./config-schema"
import type { PipelineContext } from "./context"

function buildTargetingSpec(targeting: ConfigTargeting): TargetingSpec {
	const spec: TargetingSpec = {}

	if (targeting.geoLocations) {
		spec.geo_locations = {}
		if (targeting.geoLocations.countries) {
			spec.geo_locations.countries = targeting.geoLocations.countries
		}
		if (targeting.geoLocations.regions) {
			spec.geo_locations.regions = targeting.geoLocations.regions
		}
		if (targeting.geoLocations.cities) {
			spec.geo_locations.cities = targeting.geoLocations.cities.map((c) => ({
				key: c.key,
				...(c.radius && { radius: c.radius }),
				...(c.distanceUnit && { distance_unit: c.distanceUnit }),
			}))
		}
	}

	if (targeting.ageMin) spec.age_min = targeting.ageMin
	if (targeting.ageMax) spec.age_max = targeting.ageMax
	if (targeting.genders) spec.genders = targeting.genders

	if (targeting.customAudiences.length > 0) {
		spec.custom_audiences = targeting.customAudiences.map((id) => ({ id }))
	}
	if (targeting.excludedCustomAudiences.length > 0) {
		spec.excluded_custom_audiences = targeting.excludedCustomAudiences.map((id) => ({ id }))
	}
	if (targeting.flexibleSpec) {
		spec.flexible_spec = targeting.flexibleSpec
	}
	if (targeting.userOs) {
		spec.user_os = targeting.userOs
	}

	;(spec as Record<string, unknown>).targeting_automation = {
		advantage_audience: targeting.advantageAudience ? 1 : 0,
	}

	return spec
}

export async function createAdSet(
	adSet: ConfigAdSet,
	client: MetaApiClient,
	ctx: PipelineContext,
): Promise<void> {
	console.log(`\nCreating ad set "${adSet.name}"...`)

	const campaignId = ctx.resolveRef(adSet.campaignRef)
	const targeting = buildTargetingSpec(adSet.targeting)

	if (adSet.placements === "manual" && adSet.manualPlacements) {
		if (adSet.manualPlacements.platforms) {
			targeting.publisher_platforms = adSet.manualPlacements.platforms
		}
		if (adSet.manualPlacements.facebookPositions) {
			targeting.facebook_positions = adSet.manualPlacements.facebookPositions
		}
		if (adSet.manualPlacements.instagramPositions) {
			targeting.instagram_positions = adSet.manualPlacements.instagramPositions
		}
	}

	const params: AdSetCreateParams = {
		name: adSet.name,
		campaign_id: campaignId,
		status: adSet.status,
		targeting,
		...(adSet.destinationType && { destination_type: adSet.destinationType }),
		billing_event: adSet.billingEvent,
		optimization_goal: adSet.optimizationGoal,
		...(adSet.promotedObject && {
			promoted_object: {
				...(adSet.promotedObject.pixelId && { pixel_id: adSet.promotedObject.pixelId }),
				...(adSet.promotedObject.pageId && { page_id: adSet.promotedObject.pageId }),
				...(adSet.promotedObject.customEventType && {
					custom_event_type: adSet.promotedObject.customEventType,
				}),
			},
		}),
		bid_strategy: "LOWEST_COST_WITHOUT_CAP",
		...(adSet.dailyBudget && { daily_budget: adSet.dailyBudget }),
		...(adSet.lifetimeBudget && { lifetime_budget: adSet.lifetimeBudget }),
		...(adSet.startTime && { start_time: adSet.startTime }),
		...(adSet.endTime && { end_time: adSet.endTime }),
		...(adSet.attributionSpec && {
			attribution_spec: adSet.attributionSpec.map((a) => ({
				event_type: a.eventType,
				window_days: a.windowDays,
			})),
		}),
	}

	const result = await client.createAdSet(ctx.adAccountId, params)

	ctx.setRef(adSet.ref, result.id)
	ctx.trackCreated({
		type: "adSet",
		ref: adSet.ref,
		metaId: result.id,
		name: adSet.name,
	})
}
