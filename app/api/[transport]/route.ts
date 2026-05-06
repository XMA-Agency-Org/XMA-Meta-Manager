import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { verifyToken } from "@/lib/mcp/auth"
import { registerTools } from "@/lib/mcp/tools"

const handler = createMcpHandler(
	(server) => {
		registerTools(server)
	},
	{
		serverInfo: {
			name: "xma-meta-manager",
			version: "1.0.0",
		},
	},
	{
		basePath: "/api",
		maxDuration: 300,
		verboseLogs: process.env.NODE_ENV !== "production",
	},
)

const authHandler = withMcpAuth(handler, verifyToken, {
	required: true,
	requiredScopes: ["meta:write"],
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
