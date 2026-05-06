import { db } from "@/db"
import { entityRefs } from "@/db/schema"
import { eq } from "drizzle-orm"

export function slugifyForRef(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 60)
}

export async function nextAvailableRef(base: string): Promise<string> {
	if (!db) return base
	const existing = await db.select({ ref: entityRefs.ref }).from(entityRefs).where(eq(entityRefs.ref, base))
	if (existing.length === 0) return base
	let suffix = 2
	while (true) {
		const candidate = `${base}_${suffix}`
		const check = await db.select({ ref: entityRefs.ref }).from(entityRefs).where(eq(entityRefs.ref, candidate))
		if (check.length === 0) return candidate
		suffix++
	}
}
