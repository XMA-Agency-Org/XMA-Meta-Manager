import * as fs from "node:fs"
import * as path from "node:path"
import { db } from "@/db"
import { adAccounts, clients } from "@/db/schema"

interface ClientEntry {
	slug: string
	name: string
	notes?: string
	adAccounts: Array<{ metaId: string; name?: string; currency?: string; timezone?: string }>
}

async function seed() {
	if (!db) {
		console.error("DATABASE_URL not set")
		process.exit(1)
	}

	const jsonPath = path.resolve(process.cwd(), process.argv[2] ?? "scripts/db/clients.json")
	if (!fs.existsSync(jsonPath)) {
		console.error(`clients.json not found at ${jsonPath}`)
		console.error("Create it with shape: [{ slug, name, notes?, adAccounts: [{ metaId, name? }] }]")
		process.exit(1)
	}

	const entries: ClientEntry[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))

	for (const entry of entries) {
		const [client] = await db
			.insert(clients)
			.values({ slug: entry.slug, name: entry.name, notes: entry.notes ?? null })
			.onConflictDoUpdate({ target: clients.slug, set: { name: entry.name, notes: entry.notes ?? null } })
			.returning({ id: clients.id })

		for (const acc of entry.adAccounts) {
			await db
				.insert(adAccounts)
				.values({
					clientId: client.id,
					metaId: acc.metaId,
					name: acc.name ?? null,
					currency: acc.currency ?? null,
					timezone: acc.timezone ?? null,
				})
				.onConflictDoUpdate({
					target: adAccounts.metaId,
					set: { name: acc.name ?? null, clientId: client.id },
				})
		}

		console.log(`✓ ${entry.name} (${entry.adAccounts.length} ad account${entry.adAccounts.length !== 1 ? "s" : ""})`)
	}

	console.log(`\nSeeded ${entries.length} clients.`)
	process.exit(0)
}

seed().catch((err) => {
	console.error(err)
	process.exit(1)
})
