import { eq, and, gte } from "drizzle-orm"
import { db } from "@/db/index"
import { entityRefs } from "@/db/schema"

export interface RefRecord {
	ref: string
	metaId: string
	type: string
	accountId: string | null
	parentRef: string | null
	metadata: unknown
	createdAt: Date
}

export interface RefFilter {
	type?: string
	accountId?: string
	parentRef?: string
	since?: Date
}

export async function registerRef(
	ref: string,
	metaId: string,
	type: string,
	accountId?: string,
	parentRef?: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	if (!db) return
	await db
		.insert(entityRefs)
		.values({ ref, metaId, type, accountId: accountId ?? null, parentRef: parentRef ?? null, metadata: metadata ?? null })
		.onConflictDoUpdate({
			target: entityRefs.ref,
			set: { metaId, type, accountId: accountId ?? null, parentRef: parentRef ?? null, metadata: metadata ?? null },
		})
}

export async function resolveRef(ref: string): Promise<string | null> {
	if (!db) return null
	const rows = await db.select({ metaId: entityRefs.metaId }).from(entityRefs).where(eq(entityRefs.ref, ref)).limit(1)
	return rows[0]?.metaId ?? null
}

export async function requireRef(ref: string): Promise<string> {
	const id = await resolveRef(ref)
	if (!id) {
		throw new Error(
			`Ref "${ref}" not found. Use meta_list_refs to discover known refs, or pass the Meta ID directly.`,
		)
	}
	return id
}

export async function listRefs(filter?: RefFilter): Promise<RefRecord[]> {
	if (!db) return []
	const conditions = []
	if (filter?.type) conditions.push(eq(entityRefs.type, filter.type))
	if (filter?.accountId) conditions.push(eq(entityRefs.accountId, filter.accountId))
	if (filter?.parentRef) conditions.push(eq(entityRefs.parentRef, filter.parentRef))
	if (filter?.since) conditions.push(gte(entityRefs.createdAt, filter.since))

	const rows =
		conditions.length > 0
			? await db
					.select()
					.from(entityRefs)
					.where(and(...conditions))
			: await db.select().from(entityRefs)

	return rows as RefRecord[]
}

export async function unregisterRef(ref: string): Promise<void> {
	if (!db) return
	await db.delete(entityRefs).where(eq(entityRefs.ref, ref))
}
