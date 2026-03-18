import { db } from "./index"
import { pipelineAssets, pipelineEntities, pipelineExecutions } from "./schema"
import type { PipelineContext } from "@/lib/pipeline/context"

interface PersistOptions {
	configPath: string
	adAccountId: string
	status: "completed" | "failed"
	startTime: Date
	configSnapshot?: unknown
	errorMessage?: string
	ctx?: PipelineContext
}

export async function persistPipelineResult(options: PersistOptions): Promise<void> {
	if (!db) return

	try {
		await db.transaction(async (tx) => {
			const [execution] = await tx
				.insert(pipelineExecutions)
				.values({
					adAccountId: options.adAccountId,
					configPath: options.configPath,
					status: options.status,
					executedAt: options.startTime,
					completedAt: new Date(),
					configSnapshot: options.configSnapshot ?? null,
					errorMessage: options.errorMessage ?? null,
				})
				.returning({ id: pipelineExecutions.id })

			if (!options.ctx) return

			const entities = options.ctx.createdEntities.filter(
				(e) => e.type !== "creative",
			)
			if (entities.length > 0) {
				await tx.insert(pipelineEntities).values(
					entities.map((e) => ({
						executionId: execution.id,
						entityType: e.type,
						ref: e.ref,
						metaId: e.metaId,
						name: e.name,
					})),
				)
			}

			const assets = options.ctx.createdEntities.filter(
				(e) => e.type === "creative",
			)
			if (assets.length > 0) {
				await tx.insert(pipelineAssets).values(
					assets.map((a) => ({
						executionId: execution.id,
						adAccountId: options.adAccountId,
						filename: a.name,
						assetId: a.metaId,
					})),
				)
			}
		})
	} catch (error) {
		console.warn("Failed to persist pipeline result to database:", error)
	}
}
