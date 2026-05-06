import axios, { type AxiosInstance } from "axios"
import FormData from "form-data"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type {
	AdCreateParams,
	AdCreativeCreateParams,
	AdSetCreateParams,
	CampaignCreateParams,
	ImageUploadResponse,
	MetaApiResponse,
	VideoUploadResponse,
} from "./meta-api-types"

const RATE_LIMIT_MAX_RETRIES = 3
const RATE_LIMIT_BASE_DELAY_MS = 1000

export class MetaApiError extends Error {
	code: number | undefined
	subcode: number | undefined
	type: string | undefined
	fbtrace: string | undefined

	constructor(
		message: string,
		details?: { code?: number; subcode?: number; type?: string; fbtrace?: string },
	) {
		super(message)
		this.name = "MetaApiError"
		this.code = details?.code
		this.subcode = details?.subcode
		this.type = details?.type
		this.fbtrace = details?.fbtrace
	}
}

function isRateLimitError(error: unknown): boolean {
	if (!axios.isAxiosError(error)) return false
	if (error.response?.status === 429) return true
	const metaError = error.response?.data?.error
	return metaError?.code === 17 || metaError?.code === 4
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
	for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
		try {
			return await fn()
		} catch (error) {
			if (attempt < RATE_LIMIT_MAX_RETRIES && isRateLimitError(error)) {
				const delay = RATE_LIMIT_BASE_DELAY_MS * 4 ** attempt
				console.warn(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES})...`)
				await new Promise((resolve) => setTimeout(resolve, delay))
				continue
			}
			throw error
		}
	}
	throw new Error("Unreachable")
}

function extractMetaError(error: unknown): never {
	if (axios.isAxiosError(error) && error.response?.data?.error) {
		const meta = error.response.data.error
		const message = meta.error_user_msg
			? `${meta.message}: ${meta.error_user_msg}`
			: meta.message
		throw new MetaApiError(message, {
			code: meta.code,
			subcode: meta.error_subcode,
			type: meta.type,
			fbtrace: meta.fbtrace_id,
		})
	}
	throw error
}

export class MetaApiClient {
	private client: AxiosInstance
	private accessToken: string

	constructor(accessToken: string, apiVersion = "v21.0") {
		this.accessToken = accessToken
		this.client = axios.create({
			baseURL: `https://graph.facebook.com/${apiVersion}`,
			params: { access_token: accessToken },
		})
	}

	async createCampaign(adAccountId: string, params: CampaignCreateParams): Promise<MetaApiResponse> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.post(`/${adAccountId}/campaigns`, params)
				return data as MetaApiResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async createAdSet(adAccountId: string, params: AdSetCreateParams): Promise<MetaApiResponse> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.post(`/${adAccountId}/adsets`, params)
				return data as MetaApiResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async createAdCreative(adAccountId: string, params: AdCreativeCreateParams): Promise<MetaApiResponse> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.post(`/${adAccountId}/adcreatives`, {
					...params,
					object_story_spec: JSON.stringify(params.object_story_spec),
					...(params.asset_feed_spec ? { asset_feed_spec: JSON.stringify(params.asset_feed_spec) } : {}),
				})
				return data as MetaApiResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async createAd(adAccountId: string, params: AdCreateParams): Promise<MetaApiResponse> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.post(`/${adAccountId}/ads`, {
					...params,
					creative: JSON.stringify(params.creative),
				})
				return data as MetaApiResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async uploadImage(adAccountId: string, filePath: string): Promise<ImageUploadResponse> {
		const filename = path.basename(filePath)

		const formData = new FormData()
		formData.append("filename", fs.createReadStream(filePath), filename)
		formData.append("access_token", this.accessToken)

		return withRetry(async () => {
			try {
				const { data } = await axios.post(
					`${this.client.defaults.baseURL}/${adAccountId}/adimages`,
					formData,
					{ headers: formData.getHeaders() },
				)
				return data as ImageUploadResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async uploadVideo(adAccountId: string, filePath: string): Promise<VideoUploadResponse> {
		const fileSize = fs.statSync(filePath).size
		const CHUNKED_THRESHOLD = 100 * 1024 * 1024

		if (fileSize > CHUNKED_THRESHOLD) {
			return this.uploadVideoChunked(adAccountId, filePath, fileSize)
		}

		const filename = path.basename(filePath)

		const formData = new FormData()
		formData.append("source", fs.createReadStream(filePath), filename)
		formData.append("title", filename)
		formData.append("access_token", this.accessToken)

		return withRetry(async () => {
			try {
				const { data } = await axios.post(
					`${this.client.defaults.baseURL}/${adAccountId}/advideos`,
					formData,
					{ headers: formData.getHeaders() },
				)
				return data as VideoUploadResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	private async uploadVideoChunked(
		adAccountId: string,
		filePath: string,
		fileSize: number,
	): Promise<VideoUploadResponse> {
		const filename = path.basename(filePath)
		const baseUrl = `${this.client.defaults.baseURL}/${adAccountId}/advideos`
		const CHUNK_SIZE = 20 * 1024 * 1024

		console.log(`  Using chunked upload for ${filename} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`)

		const startForm = new FormData()
		startForm.append("upload_phase", "start")
		startForm.append("file_size", String(fileSize))
		startForm.append("access_token", this.accessToken)

		const { data: startData } = await axios.post(baseUrl, startForm, {
			headers: startForm.getHeaders(),
		})
		const uploadSessionId = startData.upload_session_id
		const videoId = startData.video_id

		if (!videoId) {
			throw new Error(`Chunked upload start did not return a video ID. Response: ${JSON.stringify(startData)}`)
		}

		const fd = fs.openSync(filePath, "r")
		let startOffset = Number(startData.start_offset)
		let chunkIndex = 0

		try {
			while (startOffset < fileSize) {
				const chunkLength = Math.min(CHUNK_SIZE, fileSize - startOffset)
				const buffer = Buffer.alloc(chunkLength)
				fs.readSync(fd, buffer, 0, chunkLength, startOffset)

				const transferForm = new FormData()
				transferForm.append("upload_phase", "transfer")
				transferForm.append("upload_session_id", uploadSessionId)
				transferForm.append("start_offset", String(startOffset))
				transferForm.append("video_file_chunk", buffer, { filename: `chunk_${chunkIndex}` })
				transferForm.append("access_token", this.accessToken)

				const { data: transferData } = await axios.post(baseUrl, transferForm, {
					headers: transferForm.getHeaders(),
					maxContentLength: Number.POSITIVE_INFINITY,
					maxBodyLength: Number.POSITIVE_INFINITY,
				})

				startOffset = Number(transferData.start_offset)
				chunkIndex++
				const progress = Math.min(100, Math.round((startOffset / fileSize) * 100))
				console.log(`  Chunk ${chunkIndex} uploaded (${progress}%)`)
			}
		} finally {
			fs.closeSync(fd)
		}

		const finishForm = new FormData()
		finishForm.append("upload_phase", "finish")
		finishForm.append("upload_session_id", uploadSessionId)
		finishForm.append("title", filename)
		finishForm.append("access_token", this.accessToken)

		const { data: finishData } = await axios.post(baseUrl, finishForm, {
			headers: finishForm.getHeaders(),
		})

		console.log(`  Upload complete: ${filename} → ${videoId}`)
		return { id: String(videoId) } as VideoUploadResponse
	}

	private async paginate<T extends Record<string, unknown>>(
		path: string,
		params: Record<string, string | number>,
		maxPages = 5,
	): Promise<T[]> {
		const results: T[] = []
		let after: string | undefined
		let page = 0

		while (page < maxPages) {
			const { data } = await this.client.get(path, {
				params: { ...params, limit: 200, ...(after ? { after } : {}) },
			})
			const items: T[] = data.data ?? []
			results.push(...items)
			after = data.paging?.cursors?.after
			if (!after || items.length === 0) break
			page++
		}

		return results
	}

	async listCampaigns(
		adAccountId: string,
		fields = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time",
	): Promise<{ data: Array<Record<string, unknown>> }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get(`/${adAccountId}/campaigns`, {
					params: { fields },
				})
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async listAdSets(
		adAccountId: string,
		fields = "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,created_time",
	): Promise<{ data: Array<Record<string, unknown>> }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get(`/${adAccountId}/adsets`, {
					params: { fields },
				})
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async listAds(
		adAccountId: string,
		fields = "id,name,status,effective_status,adset_id,creative{id},created_time",
	): Promise<Array<Record<string, unknown>>> {
		return withRetry(async () => {
			try {
				return await this.paginate<Record<string, unknown>>(
					`/${adAccountId}/ads`,
					{ fields },
				)
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async listAdAccounts(): Promise<Array<Record<string, unknown>>> {
		return withRetry(async () => {
			try {
				const results = await this.paginate<Record<string, unknown>>("/me/adaccounts", {
					fields: "id,name,account_id,currency,timezone_name",
				})
				return results
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async getVideoThumbnails(videoId: string): Promise<{ data: Array<{ uri: string }> }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get(`/${videoId}/thumbnails`)
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async getVideoStatus(videoId: string): Promise<{ status: { processing_progress?: number; video_status: string } }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get(`/${videoId}`, { params: { fields: "status" } })
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async listPages(): Promise<{ data: Array<Record<string, unknown>> }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get("/me/accounts")
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async searchGeo(
		query: string,
		type: "adgeolocation" | "adcity" | "adregion" | "adcountry" = "adgeolocation",
	): Promise<{ data: Array<Record<string, unknown>> }> {
		return withRetry(async () => {
			try {
				const { data } = await this.client.get("/search", {
					params: { type, q: query },
				})
				return data
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async uploadImageFromUrl(adAccountId: string, url: string): Promise<ImageUploadResponse> {
		const response = await axios.get(url, { responseType: "arraybuffer" })
		const buffer = Buffer.from(response.data)
		const filename = path.basename(new URL(url).pathname) || "image.jpg"

		const formData = new FormData()
		formData.append("filename", buffer, { filename })
		formData.append("access_token", this.accessToken)

		return withRetry(async () => {
			try {
				const { data } = await axios.post(
					`${this.client.defaults.baseURL}/${adAccountId}/adimages`,
					formData,
					{ headers: formData.getHeaders() },
				)
				return data as ImageUploadResponse
			} catch (error) {
				extractMetaError(error)
			}
		})
	}

	async uploadVideoFromUrl(adAccountId: string, url: string): Promise<VideoUploadResponse> {
		const response = await axios.get(url, { responseType: "arraybuffer" })
		const buffer = Buffer.from(response.data)
		const filename = path.basename(new URL(url).pathname) || "video.mp4"
		const tmpPath = path.join(os.tmpdir(), `mcp_upload_${Date.now()}_${filename}`)

		fs.writeFileSync(tmpPath, buffer)
		try {
			return await this.uploadVideo(adAccountId, tmpPath)
		} finally {
			fs.unlinkSync(tmpPath)
		}
	}

	async getCampaignTree(campaignId: string): Promise<Record<string, unknown>> {
		return withRetry(async () => {
			try {
				const [campaign, adSetsResp] = await Promise.all([
					this.client.get(`/${campaignId}`, {
						params: { fields: "id,name,status,objective,daily_budget,lifetime_budget,created_time" },
					}),
					this.client.get(`/${campaignId}/adsets`, {
						params: { fields: "id,name,status,daily_budget,lifetime_budget,optimization_goal,created_time" },
					}),
				])

				const adSets = adSetsResp.data.data as Array<Record<string, unknown>>
				const adSetsWithAds = await Promise.all(
					adSets.map(async (adSet) => {
						const adsResp = await this.client.get(`/${adSet.id}/ads`, {
							params: { fields: "id,name,status,creative{id,name},created_time" },
						})
						return { ...adSet, ads: adsResp.data.data }
					}),
				)

				return { ...campaign.data, adSets: adSetsWithAds }
			} catch (error) {
				extractMetaError(error)
			}
		})
	}
}
