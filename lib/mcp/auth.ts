import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

export async function verifyToken(
	req: Request,
	bearerToken?: string,
): Promise<AuthInfo | undefined> {
	const apiKey = process.env.MCP_API_KEY?.trim()
	if (apiKey) {
		const provided = bearerToken?.trim() ?? new URL(req.url).searchParams.get("token")?.trim() ?? undefined
		if (provided !== apiKey) return undefined
	}
	return {
		token: process.env.META_APP_TOKEN ?? "",
		clientId: "meta",
		scopes: ["meta:write"],
	}
}
