import { sql } from "drizzle-orm"
import { db } from "@/db"
import { clients } from "@/db/schema"

export async function GET(req: Request) {
	const key = new URL(req.url).searchParams.get("key")
	if (key !== process.env.MCP_API_KEY) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	if (!db) return Response.json({ db: null })

	const tables = await db.execute(sql.raw(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
	))

	const cols = await db.execute(sql.raw(
		`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' ORDER BY ordinal_position`,
	))

	let insertResult: unknown = null
	let insertError: string | null = null
	try {
		const rows = await db.insert(clients).values({ slug: "test_debug", name: "Debug Test" }).returning()
		insertResult = rows
		await db.execute(sql.raw(`DELETE FROM "clients" WHERE slug = 'test_debug'`))
	} catch (err: unknown) {
		insertError = err instanceof Error
			? `${err.constructor.name}: ${err.message}`
			: String(err)
	}

	return Response.json({
		tables: tables.map((r: Record<string, unknown>) => r.table_name),
		clientsColumns: cols,
		insertResult,
		insertError,
	})
}
