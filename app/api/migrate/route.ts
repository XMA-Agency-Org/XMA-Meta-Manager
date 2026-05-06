import { drizzle } from "drizzle-orm/postgres-js"
import { sql } from "drizzle-orm"
import postgres from "postgres"

export const maxDuration = 60

const STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "clients_slug_unique" UNIQUE("slug")
)`,
	`CREATE TABLE IF NOT EXISTS "ad_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clientId" uuid NOT NULL,
  "metaId" text NOT NULL,
  "name" text,
  "currency" text,
  "timezone" text,
  "lastSyncedAt" timestamp,
  CONSTRAINT "ad_accounts_metaId_unique" UNIQUE("metaId")
)`,
	`CREATE TABLE IF NOT EXISTS "campaign_snapshots" (
  "metaId" text PRIMARY KEY NOT NULL,
  "adAccountId" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "effectiveStatus" text,
  "objective" text,
  "dailyBudget" text,
  "lifetimeBudget" text,
  "createdTime" timestamp,
  "updatedTime" timestamp,
  "raw" jsonb,
  "syncedAt" timestamp DEFAULT now() NOT NULL
)`,
	`CREATE TABLE IF NOT EXISTS "ad_set_snapshots" (
  "metaId" text PRIMARY KEY NOT NULL,
  "campaignMetaId" text NOT NULL,
  "adAccountId" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "effectiveStatus" text,
  "optimizationGoal" text,
  "dailyBudget" text,
  "lifetimeBudget" text,
  "createdTime" timestamp,
  "raw" jsonb,
  "syncedAt" timestamp DEFAULT now() NOT NULL
)`,
	`CREATE TABLE IF NOT EXISTS "ad_snapshots" (
  "metaId" text PRIMARY KEY NOT NULL,
  "adSetMetaId" text NOT NULL,
  "adAccountId" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "effectiveStatus" text,
  "creativeId" text,
  "createdTime" timestamp,
  "raw" jsonb,
  "syncedAt" timestamp DEFAULT now() NOT NULL
)`,
	`DO $$ BEGIN
    ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_clientId_clients_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
	`DO $$ BEGIN
    ALTER TABLE "ad_set_snapshots" ADD CONSTRAINT "ad_set_snapshots_adAccountId_ad_accounts_id_fk"
    FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
	`DO $$ BEGIN
    ALTER TABLE "ad_snapshots" ADD CONSTRAINT "ad_snapshots_adAccountId_ad_accounts_id_fk"
    FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
	`DO $$ BEGIN
    ALTER TABLE "campaign_snapshots" ADD CONSTRAINT "campaign_snapshots_adAccountId_ad_accounts_id_fk"
    FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
	`CREATE INDEX IF NOT EXISTS "adset_campaign_idx" ON "ad_set_snapshots" USING btree ("campaignMetaId")`,
	`CREATE INDEX IF NOT EXISTS "ad_adset_idx" ON "ad_snapshots" USING btree ("adSetMetaId")`,
]

export async function POST(req: Request) {
	const key = req.headers.get("x-migrate-key")
	if (key !== process.env.MCP_API_KEY) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const unpooledUrl = process.env.DATABASE_URL_UNPOOLED
	if (!unpooledUrl) {
		return Response.json({ error: "DATABASE_URL_UNPOOLED not set" }, { status: 500 })
	}

	const client = postgres(unpooledUrl, { max: 1 })
	const db = drizzle(client)

	const results: string[] = []
	let tablesFound: unknown[] = []
	try {
		for (const stmt of STATEMENTS) {
			try {
				await db.execute(sql.raw(stmt))
				results.push("ok")
			} catch (error) {
				results.push(`error: ${error}`)
			}
		}
		const check = await db.execute(sql.raw(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('clients','ad_accounts','campaign_snapshots','ad_set_snapshots','ad_snapshots') ORDER BY table_name`,
		))
		tablesFound = check.map((r: Record<string, unknown>) => r.table_name)
	} finally {
		await client.end()
	}

	return Response.json({ ok: true, results, tablesFound, urlPrefix: unpooledUrl.slice(0, 30) })
}
