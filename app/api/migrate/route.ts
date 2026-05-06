import { sql } from "drizzle-orm"
import { db } from "@/db"

export const maxDuration = 60

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "ad_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clientId" uuid NOT NULL,
  "metaId" text NOT NULL,
  "name" text,
  "currency" text,
  "timezone" text,
  "lastSyncedAt" timestamp,
  CONSTRAINT "ad_accounts_metaId_unique" UNIQUE("metaId")
);

CREATE TABLE IF NOT EXISTS "campaign_snapshots" (
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
);

CREATE TABLE IF NOT EXISTS "ad_set_snapshots" (
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
);

CREATE TABLE IF NOT EXISTS "ad_snapshots" (
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
);

ALTER TABLE "ad_accounts"
  ADD CONSTRAINT IF NOT EXISTS "ad_accounts_clientId_clients_id_fk"
  FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "ad_set_snapshots"
  ADD CONSTRAINT IF NOT EXISTS "ad_set_snapshots_adAccountId_ad_accounts_id_fk"
  FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "ad_snapshots"
  ADD CONSTRAINT IF NOT EXISTS "ad_snapshots_adAccountId_ad_accounts_id_fk"
  FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "campaign_snapshots"
  ADD CONSTRAINT IF NOT EXISTS "campaign_snapshots_adAccountId_ad_accounts_id_fk"
  FOREIGN KEY ("adAccountId") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "adset_campaign_idx" ON "ad_set_snapshots" USING btree ("campaignMetaId");
CREATE INDEX IF NOT EXISTS "ad_adset_idx" ON "ad_snapshots" USING btree ("adSetMetaId");
`

export async function POST(req: Request) {
	const key = req.headers.get("x-migrate-key")
	if (key !== process.env.MCP_API_KEY) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	if (!db) {
		return Response.json({ error: "DATABASE_URL not set" }, { status: 500 })
	}

	try {
		await db.execute(sql.raw(MIGRATION_SQL))
		return Response.json({ ok: true, message: "Migration complete" })
	} catch (error) {
		return Response.json({ error: String(error) }, { status: 500 })
	}
}
