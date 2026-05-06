import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"

export const clients = pgTable("clients", {
	id: uuid().primaryKey().defaultRandom(),
	slug: text().notNull().unique(),
	name: text().notNull(),
	notes: text(),
	createdAt: timestamp().notNull().defaultNow(),
})

export const adAccounts = pgTable("ad_accounts", {
	id: uuid().primaryKey().defaultRandom(),
	clientId: uuid()
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	metaId: text().notNull().unique(),
	name: text(),
	currency: text(),
	timezone: text(),
	lastSyncedAt: timestamp(),
})

export const campaignSnapshots = pgTable("campaign_snapshots", {
	metaId: text().primaryKey(),
	adAccountId: uuid()
		.notNull()
		.references(() => adAccounts.id, { onDelete: "cascade" }),
	name: text().notNull(),
	status: text(),
	effectiveStatus: text(),
	objective: text(),
	dailyBudget: text(),
	lifetimeBudget: text(),
	createdTime: timestamp(),
	updatedTime: timestamp(),
	raw: jsonb(),
	syncedAt: timestamp().notNull().defaultNow(),
})

export const adSetSnapshots = pgTable(
	"ad_set_snapshots",
	{
		metaId: text().primaryKey(),
		campaignMetaId: text().notNull(),
		adAccountId: uuid()
			.notNull()
			.references(() => adAccounts.id, { onDelete: "cascade" }),
		name: text().notNull(),
		status: text(),
		effectiveStatus: text(),
		optimizationGoal: text(),
		dailyBudget: text(),
		lifetimeBudget: text(),
		createdTime: timestamp(),
		raw: jsonb(),
		syncedAt: timestamp().notNull().defaultNow(),
	},
	(t) => [index("adset_campaign_idx").on(t.campaignMetaId)],
)

export const adSnapshots = pgTable(
	"ad_snapshots",
	{
		metaId: text().primaryKey(),
		adSetMetaId: text().notNull(),
		adAccountId: uuid()
			.notNull()
			.references(() => adAccounts.id, { onDelete: "cascade" }),
		name: text().notNull(),
		status: text(),
		effectiveStatus: text(),
		creativeId: text(),
		createdTime: timestamp(),
		raw: jsonb(),
		syncedAt: timestamp().notNull().defaultNow(),
	},
	(t) => [index("ad_adset_idx").on(t.adSetMetaId)],
)

export const pipelineExecutions = pgTable("pipeline_executions", {
	id: uuid().primaryKey().defaultRandom(),
	adAccountId: text().notNull(),
	configPath: text().notNull(),
	status: text().notNull(),
	executedAt: timestamp().notNull(),
	completedAt: timestamp(),
	configSnapshot: jsonb(),
	errorMessage: text(),
})

export const pipelineEntities = pgTable("pipeline_entities", {
	id: uuid().primaryKey().defaultRandom(),
	executionId: uuid().references(() => pipelineExecutions.id, { onDelete: "cascade" }),
	entityType: text().notNull(),
	ref: text().notNull(),
	metaId: text().notNull(),
	name: text().notNull(),
	source: text().notNull().default("pipeline"),
})

export const entityRefs = pgTable("entity_refs", {
	ref: text().primaryKey(),
	metaId: text().notNull(),
	type: text().notNull(),
	accountId: text(),
	parentRef: text(),
	metadata: jsonb(),
	createdAt: timestamp().notNull().defaultNow(),
})

export const pipelineAssets = pgTable(
	"pipeline_assets",
	{
		id: uuid().primaryKey().defaultRandom(),
		executionId: uuid()
			.notNull()
			.references(() => pipelineExecutions.id, { onDelete: "cascade" }),
		adAccountId: text().notNull(),
		filename: text().notNull(),
		assetId: text().notNull(),
		uploadedAt: timestamp().defaultNow(),
	},
	(table) => [index("asset_account_filename_idx").on(table.adAccountId, table.filename)],
)
