import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"

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
	executionId: uuid()
		.notNull()
		.references(() => pipelineExecutions.id, { onDelete: "cascade" }),
	entityType: text().notNull(),
	ref: text().notNull(),
	metaId: text().notNull(),
	name: text().notNull(),
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
