import { MetaApiClient } from "@/lib/meta-api"
import { runPipeline } from "@/lib/pipeline/executor"

async function main() {
	const args = process.argv.slice(2)
	const configPath = args.find((a) => !a.startsWith("--"))
	const dryRun = args.includes("--dry-run")

	if (!configPath) {
		console.error("Usage: bun scripts/meta/run-pipeline.ts <config.yaml> [--dry-run]")
		process.exit(1)
	}

	const accessToken = process.env.META_APP_TOKEN
	if (!accessToken) {
		console.error("Missing META_APP_TOKEN environment variable.")
		console.error("Set it in .env.local or export it before running.")
		process.exit(1)
	}

	const client = new MetaApiClient(accessToken)

	try {
		await runPipeline(configPath, client, { dryRun })
		process.exit(0)
	} catch (error) {
		if (error instanceof Error) {
			console.error(`\nError: ${error.message}`)
			if (error.stack) console.error(error.stack)
		} else {
			console.error("\nUnknown error:", error)
		}
		process.exit(1)
	}
}

main()
