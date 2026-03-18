import axios, { type AxiosInstance } from "axios"
import FormData from "form-data"
import * as fs from "node:fs"
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

	async listCampaigns(
		adAccountId: string,
		fields = "id,name,status,objective",
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
		fields = "id,name,status,campaign_id,daily_budget",
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
}
