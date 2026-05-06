import { db } from "@/db"
import { adAccounts, adSetSnapshots, adSnapshots, campaignSnapshots, clients } from "@/db/schema"
import { entityRefs } from "@/db/schema"
import type { MetaApiClient } from "@/lib/meta-api"
import { eq } from "drizzle-orm"
import { slugifyForRef, nextAvailableRef } from "./refs"

export interface SyncResult {
	adAccountId: string
	campaigns: number
	adSets: number
	ads: number
	durationMs: number
}

function parseTimestamp(value: unknown): Date | null {
	if (!value || typeof value !== "string") return null
	const d = new Date(value)
	return Number.isNaN(d.getTime()) ? null : d
}

export async function syncAdAccount(
	client: MetaApiClient,
	adAccountRow: { id: string; metaId: string; clientId: string },
): Promise<SyncResult> {
	if (!db) throw new Error("DATABASE_URL not set — cannot sync")
	const start = Date.now()

	const clientRow = await db.select({ slug: clients.slug }).from(clients).where(eq(clients.id, adAccountRow.clientId))
	const clientSlug = clientRow[0]?.slug ?? "unknown"

	const [rawCampaigns, rawAdSets, rawAds] = await Promise.all([
		client.listCampaigns(adAccountRow.metaId).then((r) => r.data),
		client.listAdSets(adAccountRow.metaId).then((r) => r.data),
		client.listAds(adAccountRow.metaId),
	])

	await db.transaction(async (tx) => {
		for (const c of rawCampaigns) {
			await tx
				.insert(campaignSnapshots)
				.values({
					metaId: String(c.id),
					adAccountId: adAccountRow.id,
					name: String(c.name ?? ""),
					status: c.status != null ? String(c.status) : null,
					effectiveStatus: c.effective_status != null ? String(c.effective_status) : null,
					objective: c.objective != null ? String(c.objective) : null,
					dailyBudget: c.daily_budget != null ? String(c.daily_budget) : null,
					lifetimeBudget: c.lifetime_budget != null ? String(c.lifetime_budget) : null,
					createdTime: parseTimestamp(c.created_time),
					updatedTime: parseTimestamp(c.updated_time),
					raw: c,
					syncedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: campaignSnapshots.metaId,
					set: {
						name: String(c.name ?? ""),
						status: c.status != null ? String(c.status) : null,
						effectiveStatus: c.effective_status != null ? String(c.effective_status) : null,
						objective: c.objective != null ? String(c.objective) : null,
						dailyBudget: c.daily_budget != null ? String(c.daily_budget) : null,
						lifetimeBudget: c.lifetime_budget != null ? String(c.lifetime_budget) : null,
						updatedTime: parseTimestamp(c.updated_time),
						raw: c,
						syncedAt: new Date(),
					},
				})
		}

		for (const s of rawAdSets) {
			await tx
				.insert(adSetSnapshots)
				.values({
					metaId: String(s.id),
					campaignMetaId: String(s.campaign_id ?? ""),
					adAccountId: adAccountRow.id,
					name: String(s.name ?? ""),
					status: s.status != null ? String(s.status) : null,
					effectiveStatus: s.effective_status != null ? String(s.effective_status) : null,
					optimizationGoal: s.optimization_goal != null ? String(s.optimization_goal) : null,
					dailyBudget: s.daily_budget != null ? String(s.daily_budget) : null,
					lifetimeBudget: s.lifetime_budget != null ? String(s.lifetime_budget) : null,
					createdTime: parseTimestamp(s.created_time),
					raw: s,
					syncedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: adSetSnapshots.metaId,
					set: {
						name: String(s.name ?? ""),
						status: s.status != null ? String(s.status) : null,
						effectiveStatus: s.effective_status != null ? String(s.effective_status) : null,
						optimizationGoal: s.optimization_goal != null ? String(s.optimization_goal) : null,
						dailyBudget: s.daily_budget != null ? String(s.daily_budget) : null,
						lifetimeBudget: s.lifetime_budget != null ? String(s.lifetime_budget) : null,
						raw: s,
						syncedAt: new Date(),
					},
				})
		}

		for (const a of rawAds) {
			const creativeId = a.creative != null && typeof a.creative === "object"
				? String((a.creative as Record<string, unknown>).id ?? "")
				: null
			await tx
				.insert(adSnapshots)
				.values({
					metaId: String(a.id),
					adSetMetaId: String(a.adset_id ?? ""),
					adAccountId: adAccountRow.id,
					name: String(a.name ?? ""),
					status: a.status != null ? String(a.status) : null,
					effectiveStatus: a.effective_status != null ? String(a.effective_status) : null,
					creativeId,
					createdTime: parseTimestamp(a.created_time),
					raw: a,
					syncedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: adSnapshots.metaId,
					set: {
						name: String(a.name ?? ""),
						status: a.status != null ? String(a.status) : null,
						effectiveStatus: a.effective_status != null ? String(a.effective_status) : null,
						creativeId,
						raw: a,
						syncedAt: new Date(),
					},
				})
		}

		await tx
			.update(adAccounts)
			.set({ lastSyncedAt: new Date() })
			.where(eq(adAccounts.id, adAccountRow.id))
	})

	await bulkRegisterRefs(clientSlug, adAccountRow.metaId, rawCampaigns, rawAdSets, rawAds)

	return {
		adAccountId: adAccountRow.metaId,
		campaigns: rawCampaigns.length,
		adSets: rawAdSets.length,
		ads: rawAds.length,
		durationMs: Date.now() - start,
	}
}

async function bulkRegisterRefs(
	clientSlug: string,
	adAccountMetaId: string,
	campaigns: Array<Record<string, unknown>>,
	adSets: Array<Record<string, unknown>>,
	ads: Array<Record<string, unknown>>,
) {
	if (!db) return

	for (const c of campaigns) {
		const base = `${clientSlug}/${slugifyForRef(String(c.name ?? c.id))}`
		const ref = await nextAvailableRef(base)
		await db
			.insert(entityRefs)
			.values({ ref, metaId: String(c.id), type: "campaign", accountId: adAccountMetaId, createdAt: new Date() })
			.onConflictDoNothing()
	}

	for (const s of adSets) {
		const base = `${clientSlug}/${slugifyForRef(String(s.name ?? s.id))}`
		const ref = await nextAvailableRef(base)
		await db
			.insert(entityRefs)
			.values({ ref, metaId: String(s.id), type: "adSet", accountId: adAccountMetaId, createdAt: new Date() })
			.onConflictDoNothing()
	}

	for (const a of ads) {
		const base = `${clientSlug}/${slugifyForRef(String(a.name ?? a.id))}`
		const ref = await nextAvailableRef(base)
		await db
			.insert(entityRefs)
			.values({ ref, metaId: String(a.id), type: "ad", accountId: adAccountMetaId, createdAt: new Date() })
			.onConflictDoNothing()
	}
}

export async function syncAllAdAccounts(client: MetaApiClient): Promise<SyncResult[]> {
	if (!db) throw new Error("DATABASE_URL not set — cannot sync")

	const accounts = await db.select().from(adAccounts)
	const results: SyncResult[] = []

	for (const account of accounts) {
		const result = await syncAdAccount(client, account)
		results.push(result)
	}

	return results
}
