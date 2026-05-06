import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

export async function verifyToken(
	req: Request,
	bearerToken?: string,
): Promise<AuthInfo | undefined> {
	const token = bearerToken ?? new URL(req.url).searchParams.get("token") ?? undefined
	if (!token) return undefined
	return {
		token,
		clientId: "meta",
		scopes: ["meta:write"],
	}
}
