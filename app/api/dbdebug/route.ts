import { sql } from "drizzle-orm"
import { db } from "@/db"

export async function GET(req: Request) {
	const key = new URL(req.url).searchParams.get("key")
	if (key !== process.env.MCP_API_KEY) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	if (!db) return Response.json({ db: null })

	const tables = await db.execute(sql.raw(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
	))

	const dbUrl = process.env.DATABASE_URL?.slice(0, 40) ?? "not set"

	return Response.json({ dbUrlPrefix: dbUrl, tables: tables.map((r: Record<string, unknown>) => r.table_name) })
}
