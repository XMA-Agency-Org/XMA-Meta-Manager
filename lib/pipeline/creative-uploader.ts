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

interface CreativeSource {
	key: string
	file?: string
	fileUrl?: string
}

export async function uploadCreatives(
	config: PipelineConfig,
	creativesDir: string,
	client: MetaApiClient,
	ctx: PipelineContext,
): Promise<void> {
	const allSources: CreativeSource[] = []
	for (const ad of config.ads) {
		if (ad.creative.fileUrl) {
			allSources.push({ key: `url:${ad.creative.fileUrl}`, fileUrl: ad.creative.fileUrl })
		} else if (ad.creative.file) {
			allSources.push({ key: `file:${ad.creative.file}`, file: ad.creative.file })
		}
		if (ad.creative.slides) {
			for (const slide of ad.creative.slides) {
				if (slide.fileUrl) {
					allSources.push({ key: `url:${slide.fileUrl}`, fileUrl: slide.fileUrl })
				} else if (slide.file) {
					allSources.push({ key: `file:${slide.file}`, file: slide.file })
				}
			}
		}
	}

	const seen = new Set<string>()
	const uniqueSources = allSources.filter((s) => {
		if (seen.has(s.key)) return false
		seen.add(s.key)
		return true
	})

	if (uniqueSources.length === 0) return

	const existingIds = loadExistingCreativeIds(path.dirname(creativesDir))
	const toUpload = uniqueSources.filter((s) => !existingIds.has(s.key))
	const cached = uniqueSources.filter((s) => existingIds.has(s.key))

	if (cached.length > 0) {
		console.log(`\nUsing ${cached.length} cached creative(s) from _result.yaml`)
		for (const source of cached) {
			const assetId = existingIds.get(source.key)!
			ctx.setRef(source.key, assetId)
			ctx.trackCreated({ type: "creative", ref: source.key, metaId: assetId, name: source.key })
		}
	}

	if (toUpload.length === 0) return

	console.log(`\nUploading ${toUpload.length} creative(s)...`)

	for (const source of toUpload) {
		if (source.fileUrl) {
			const urlFilename = path.basename(new URL(source.fileUrl).pathname) || source.fileUrl
			const mediaType = getMediaType(urlFilename)
			if (mediaType === "image") {
				const result = await client.uploadImageFromUrl(config.adAccountId, source.fileUrl)
				const imageEntry = Object.values(result.images)[0]
				if (!imageEntry?.hash) throw new Error(`Failed to get image hash for ${source.fileUrl}`)
				ctx.setRef(source.key, imageEntry.hash)
				ctx.trackCreated({ type: "creative", ref: source.key, metaId: imageEntry.hash, name: urlFilename })
			} else {
				const result = await client.uploadVideoFromUrl(config.adAccountId, source.fileUrl)
				ctx.setRef(source.key, result.id)
				ctx.trackCreated({ type: "creative", ref: source.key, metaId: result.id, name: urlFilename })
			}
		} else if (source.file) {
			if (process.env.PIPELINE_LOCAL_FS !== "1") {
				throw new Error(
					`Local file uploads are disabled in this environment. Use 'fileUrl' instead of 'file'. Set PIPELINE_LOCAL_FS=1 to allow local file uploads (local dev only).`,
				)
			}
			const filePath = path.join(creativesDir, source.file)
			const mediaType = getMediaType(source.file)
			if (mediaType === "image") {
				const result = await client.uploadImage(config.adAccountId, filePath)
				const imageEntry = Object.values(result.images)[0]
				if (!imageEntry?.hash) throw new Error(`Failed to get image hash for ${source.file}`)
				ctx.setRef(source.key, imageEntry.hash)
				ctx.trackCreated({ type: "creative", ref: source.key, metaId: imageEntry.hash, name: source.file })
			} else {
				const result = await client.uploadVideo(config.adAccountId, filePath)
				ctx.setRef(source.key, result.id)
				ctx.trackCreated({ type: "creative", ref: source.key, metaId: result.id, name: source.file })
			}
		}
	}
}
