import * as fs from "node:fs"
import * as path from "node:path"
import { parse as parseYaml } from "yaml"
import type { MetaApiClient } from "@/lib/meta-api"
import type { PipelineConfig } from "./config-schema"
import type { PipelineContext } from "./context"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"])
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov"])

function getMediaType(filename: string): "image" | "video" {
	const ext = path.extname(filename).toLowerCase()
	if (IMAGE_EXTENSIONS.has(ext)) return "image"
	if (VIDEO_EXTENSIONS.has(ext)) return "video"
	throw new Error(`Unsupported file type: ${filename} (supported: ${[...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].join(", ")})`)
}

function loadExistingCreativeIds(configDir: string): Map<string, string> {
	const resultPath = path.join(configDir, "_result.yaml")
	const existing = new Map<string, string>()

	if (!fs.existsSync(resultPath)) return existing

	try {
		const raw = fs.readFileSync(resultPath, "utf-8")
		const result = parseYaml(raw)
		if (Array.isArray(result?.creatives)) {
			for (const entry of result.creatives) {
				if (entry.file && entry.assetId) {
					existing.set(entry.file, String(entry.assetId))
				}
			}
		}
	} catch {
		// ignore parse errors, will re-upload
	}

	return existing
}

export async function uploadCreatives(
	config: PipelineConfig,
	creativesDir: string,
	client: MetaApiClient,
	ctx: PipelineContext,
): Promise<void> {
	const allFiles: string[] = []
	for (const ad of config.ads) {
		if (ad.creative.file) allFiles.push(ad.creative.file)
		if (ad.creative.slides) {
			for (const slide of ad.creative.slides) allFiles.push(slide.file)
		}
	}
	const uniqueFiles = [...new Set(allFiles)]
	if (uniqueFiles.length === 0) return

	const existingIds = loadExistingCreativeIds(path.dirname(creativesDir))
	const toUpload = uniqueFiles.filter((f) => !existingIds.has(f))
	const cached = uniqueFiles.filter((f) => existingIds.has(f))

	if (cached.length > 0) {
		console.log(`\nUsing ${cached.length} cached creative(s) from _result.yaml`)
		for (const filename of cached) {
			const assetId = existingIds.get(filename)!
			ctx.setRef(`file:${filename}`, assetId)
			ctx.trackCreated({
				type: "creative",
				ref: `file:${filename}`,
				metaId: assetId,
				name: filename,
			})
		}
	}

	if (toUpload.length === 0) return

	console.log(`\nUploading ${toUpload.length} creative(s)...`)

	for (const filename of toUpload) {
		const filePath = path.join(creativesDir, filename)
		const mediaType = getMediaType(filename)

		if (mediaType === "image") {
			const result = await client.uploadImage(config.adAccountId, filePath)
			const imageEntry = Object.values(result.images)[0]
			if (!imageEntry?.hash) {
				throw new Error(`Failed to get image hash for ${filename}`)
			}
			ctx.setRef(`file:${filename}`, imageEntry.hash)
			ctx.trackCreated({
				type: "creative",
				ref: `file:${filename}`,
				metaId: imageEntry.hash,
				name: filename,
			})
		} else {
			const result = await client.uploadVideo(config.adAccountId, filePath)
			ctx.setRef(`file:${filename}`, result.id)
			ctx.trackCreated({
				type: "creative",
				ref: `file:${filename}`,
				metaId: result.id,
				name: filename,
			})
		}
	}
}
