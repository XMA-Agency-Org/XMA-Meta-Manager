import * as fs from "node:fs"
import * as path from "node:path"
import { MetaApiClient } from "@/lib/meta-api"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"])
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov"])

async function main() {
	const args = process.argv.slice(2)
	let accountId = ""
	let dirPath = ""

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--account" && args[i + 1]) {
			accountId = args[++i]
		} else if (args[i] === "--dir" && args[i + 1]) {
			dirPath = args[++i]
		}
	}

	if (!accountId || !dirPath) {
		console.error("Usage: bun scripts/meta/upload-creatives.ts --account act_XXXXX --dir ./path/to/creatives/")
		process.exit(1)
	}

	const accessToken = process.env.META_APP_TOKEN
	if (!accessToken) {
		console.error("Missing META_APP_TOKEN environment variable.")
		process.exit(1)
	}

	const resolvedDir = path.resolve(dirPath)
	if (!fs.existsSync(resolvedDir)) {
		console.error(`Directory not found: ${resolvedDir}`)
		process.exit(1)
	}

	const files = fs.readdirSync(resolvedDir).filter((f) => {
		const ext = path.extname(f).toLowerCase()
		return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
	})

	if (files.length === 0) {
		console.error("No supported media files found in directory.")
		process.exit(1)
	}

	console.log(`Found ${files.length} file(s) to upload.`)

	const client = new MetaApiClient(accessToken)
	const results: Array<{ file: string; type: string; assetId: string }> = []

	for (const file of files) {
		const filePath = path.join(resolvedDir, file)
		const ext = path.extname(file).toLowerCase()
		const isImage = IMAGE_EXTENSIONS.has(ext)

		try {
			if (isImage) {
				const result = await client.uploadImage(accountId, filePath)
				const hash = Object.values(result.images)[0]?.hash
				if (hash) {
					results.push({ file, type: "image", assetId: hash })
					console.log(`  ✓ ${file} → hash: ${hash}`)
				}
			} else {
				const result = await client.uploadVideo(accountId, filePath)
				results.push({ file, type: "video", assetId: result.id })
				console.log(`  ✓ ${file} → id: ${result.id}`)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(`  ✗ ${file} → ${message}`)
		}
	}

	console.log(`\nUploaded ${results.length}/${files.length} files.`)

	if (results.length > 0) {
		console.log("\nResults:")
		for (const r of results) {
			console.log(`  ${r.file}: ${r.assetId}`)
		}
	}
}

main()
