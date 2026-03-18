import axios from "axios"

const accessToken = process.env.META_APP_TOKEN
if (!accessToken) {
	console.error("Missing META_APP_TOKEN in .env.local")
	process.exit(1)
}

const adAccountId = process.argv[2] || "act_279890659888368"
const baseUrl = "https://graph.facebook.com/v21.0"

async function listPages() {
	console.log("Fetching Facebook Pages you manage...\n")

	try {
		const { data } = await axios.get(`${baseUrl}/me/accounts`, {
			params: { access_token: accessToken, fields: "id,name,instagram_business_account{id,username}" },
		})

		if (!data.data?.length) {
			console.log("No pages found. Your token may not have pages_read_engagement permission.")
			return
		}

		for (const page of data.data) {
			console.log(`Facebook Page: "${page.name}"`)
			console.log(`  Page ID: ${page.id}`)
			if (page.instagram_business_account) {
				console.log(`  Instagram ID: ${page.instagram_business_account.id}`)
				console.log(`  Instagram Username: @${page.instagram_business_account.username}`)
			} else {
				console.log("  Instagram: not linked")
			}
			console.log()
		}
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Meta API error:", error.response?.data?.error?.message || error.message)
		} else {
			throw error
		}
	}
}

listPages()
