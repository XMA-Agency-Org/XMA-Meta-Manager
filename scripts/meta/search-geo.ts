import axios from "axios"

const accessToken = process.env.META_APP_TOKEN
if (!accessToken) {
	console.error("Missing META_APP_TOKEN in .env.local")
	process.exit(1)
}

const baseUrl = "https://graph.facebook.com/v21.0"

const cities = ["New York", "Los Angeles", "Miami", "Houston", "Chicago"]

async function searchCity(query: string) {
	const { data } = await axios.get(`${baseUrl}/search`, {
		params: {
			access_token: accessToken,
			type: "adgeolocation",
			q: query,
			location_types: '["city"]',
		},
	})
	return data.data
}

async function main() {
	for (const city of cities) {
		console.log(`\nSearching: ${city}`)
		try {
			const results = await searchCity(city)
			const usResults = results.filter(
				(r: Record<string, unknown>) => r.country_code === "US",
			)
			for (const r of usResults.slice(0, 3)) {
				console.log(`  key: ${r.key} | ${r.name}, ${r.region} | type: ${r.type}`)
			}
		} catch (error) {
			if (axios.isAxiosError(error)) {
				console.error(`  Error: ${error.response?.data?.error?.message || error.message}`)
			} else {
				throw error
			}
		}
	}
}

main()
