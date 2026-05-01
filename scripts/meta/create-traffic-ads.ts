import { MetaApiClient } from "@/lib/meta-api"
import type { AdCreativeCreateParams, AssetFeedSpec, ObjectStorySpec } from "@/lib/meta-api-types"

const ACCOUNT_ID = "act_279890659888368"
const AD_SET_ID = "120243744802920028"
const PAGE_ID = "773383349196089"
const IG_ACTOR_ID = "17841472671703071"
const LINK_URL = "https://www.instagram.com/floareauae/"

const ads = [
	{
		name: "Girls Dream - All Collections Showcase",
		videoId: "1627387595253252",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=girls_dream_showcase",
		primaryTexts: [
			"Every girl deserves flowers that match her energy \u2728\n\nFresh bouquets, forever roses, luxury bundles \u2014 all in one place.\n\n\ud83d\udc47 See the full collection on our profile.",
			"Dream bouquets are real. You just haven't seen ours yet \ud83c\udf39\n\nExplore Floarea's full range \u2014 from fresh arrangements to forever roses that last for years.\n\n\ud83d\udc47 Tap through our profile.",
			"Luxury flowers for every mood, moment, and milestone \ud83d\udc90\n\nHandcrafted bouquets and forever roses \u2014 curated just for you.\n\n\ud83d\udc47 Browse our profile to see them all.",
			"She didn't ask for flowers. She asked to feel special \ud83c\udf38\n\nFloarea's collection was made for exactly that. Fresh, forever, and everything in between.\n\n\ud83d\udc47 Visit our profile.",
			"Stop scrolling. Start gifting \ud83c\udf39\n\nFrom fresh bouquets to forever roses \u2014 Floarea has something for every occasion. Handcrafted in Dubai.\n\n\ud83d\udc47 Explore our profile.",
		],
		headlines: [
			"Every Bouquet in One Place",
			"Luxury Flowers for Every Occasion",
			"Explore the Full Collection",
			"Fresh Bouquets. Forever Roses. All Here.",
			"See What You've Been Missing",
		],
	},
	{
		name: "25% Off + Free Delivery",
		videoId: "1305152871534706",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=25_off_free_delivery",
		primaryTexts: [
			"25% off everything + free delivery \ud83d\ude97\n\nLuxury flowers at prices you won't find anywhere else. Limited time only.\n\n\ud83d\udc47 Follow us so you never miss a deal.",
			"This might be the best deal on luxury flowers in Dubai right now \ud83d\udc90\n\n25% off + free delivery on every order. No code needed.\n\n\ud83d\udc47 Follow us for more offers like this.",
			"Luxury doesn't have to cost a fortune \ud83c\udf39\n\nRight now: 25% off our entire collection + free delivery across Dubai.\n\n\ud83d\udc47 Check our profile for details.",
			"Free delivery + 25% off? Say less \ud83d\ude97\u2728\n\nHandcrafted luxury bouquets delivered to your door \u2014 for less than you'd expect.\n\n\ud83d\udc47 Tap our profile to see the collection.",
			"Your sign to finally order those flowers \ud83c\udf38\n\n25% off + free delivery. No minimum order. No excuses.\n\n\ud83d\udc47 Follow us and save.",
		],
		headlines: [
			"25% Off + Free Delivery",
			"Luxury Flowers, Unbeatable Price",
			"Don't Miss This Deal",
			"Free Delivery on Every Order",
			"Save 25% on Luxury Bouquets",
		],
	},
	{
		name: "Life With Her Life Without Her",
		videoId: "4106924039597813",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=life_with_her",
		primaryTexts: [
			"Life with flowers hits different \ud83c\udf38\n\nAdd a little luxury to your everyday \u2014 handcrafted bouquets delivered in 1 hour across Dubai.\n\n\ud83d\udc47 Follow us for daily inspiration.",
			"Before flowers vs. after flowers \u2014 the difference is everything \ud83c\udf39\n\nFloarea brings luxury blooms that transform any space and any moment.\n\n\ud83d\udc47 See more on our profile.",
			"Some things just make life better. Flowers are one of them \ud83d\udc90\n\nDiscover Floarea's handcrafted luxury bouquets and forever roses.\n\n\ud83d\udc47 Follow for your daily dose of beauty.",
			"Flowers don't just sit in a vase. They change the whole mood \u2728\n\nFresh arrangements. Forever roses. Luxury delivered to your door.\n\n\ud83d\udc47 Visit our profile.",
			"You didn't know you needed flowers until you had them \ud83c\udf38\n\nLet Floarea add a little magic to your everyday.\n\n\ud83d\udc47 Follow us and see why.",
		],
		headlines: [
			"Life With Flowers Hits Different",
			"Transform Any Moment With Flowers",
			"Before Flowers vs. After Flowers",
			"Flowers Change Everything",
			"Add Luxury to Your Everyday",
		],
	},
	{
		name: "This Is Your Sign to Surprise Her",
		videoId: "957732396941773",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=sign_to_surprise",
		primaryTexts: [
			"This is your sign \ud83d\udc90\n\nStop waiting for a special occasion. Surprise her today with handcrafted luxury flowers \u2014 delivered in 1 hour across Dubai.\n\n\ud83d\udc47 Follow us for gifting ideas.",
			"She's not going to tell you she wants flowers. But she does \ud83c\udf39\n\nFloarea's luxury bouquets \u2014 handcrafted, delivered fast, and guaranteed to make her day.\n\n\ud83d\udc47 Follow us.",
			"You've been thinking about it. Now just do it \ud83c\udf38\n\nSurprise her with flowers from Floarea \u2014 luxury bouquets delivered in 1 hour anywhere in Dubai.\n\n\ud83d\udc47 Tap our profile.",
			"The best gifts are the ones she doesn't expect \u2728\n\nSurprise her with Floarea's handcrafted luxury bouquets. Delivered in 1 hour. No occasion needed.\n\n\ud83d\udc47 Visit our profile.",
			"Don't overthink it. Just send her flowers \ud83d\udc90\n\nFloarea makes it easy \u2014 luxury bouquets handcrafted and delivered in 1 hour across Dubai.\n\n\ud83d\udc47 Follow us for more ideas.",
		],
		headlines: [
			"This Is Your Sign \u2014 Surprise Her",
			"She Deserves Flowers Today",
			"Don't Wait for a Special Occasion",
			"Surprise Her With Luxury Flowers",
			"1-Hour Delivery Across Dubai",
		],
	},
	{
		name: "Obsessed With Flowers",
		videoId: "1710754683427968",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=obsessed_with_flowers",
		primaryTexts: [
			"If your feed is all flowers, you belong here \ud83c\udf39\n\nFloarea \u2014 handcrafted luxury bouquets and forever roses for the truly flower obsessed.\n\n\ud83d\udc47 Follow us.",
			"Flower obsessed? Welcome home \ud83c\udf38\n\nDiscover Floarea's luxury arrangements \u2014 fresh bouquets, forever roses, and everything in between.\n\n\ud83d\udc47 Tap our profile.",
			"We get it. You can't stop looking at flowers \ud83d\udc90\n\nNeither can we. That's why we handcraft every single bouquet to perfection.\n\n\ud83d\udc47 Follow Floarea.",
			"This account is for people who stop to smell the roses \ud83c\udf39\n\nLuxury bouquets. Forever roses. Fresh arrangements. All handcrafted in Dubai.\n\n\ud83d\udc47 Visit our profile.",
			"Some people collect shoes. We collect petals \ud83c\udf38\n\nJoin the flower-obsessed community \u2014 follow Floarea for daily luxury floral content.\n\n\ud83d\udc47 Tap our profile.",
		],
		headlines: [
			"For the Flower Obsessed",
			"Welcome to Floarea",
			"Your Daily Dose of Blooms",
			"Follow for Luxury Floral Content",
			"Handcrafted With Love in Dubai",
		],
	},
	{
		name: "Surprise the One You Love",
		videoId: "2097810694337341",
		urlTags: "utm_source=meta&utm_medium=paid&utm_campaign=social_media_traffic&utm_content=surprise_the_one",
		primaryTexts: [
			"The easiest way to make someone's entire day? Flowers \ud83c\udf38\n\nSurprise the one you love with Floarea's handcrafted luxury bouquets \u2014 delivered in 1 hour across Dubai.\n\n\ud83d\udc47 Follow us.",
			"Love is in the details. And flowers are the detail that never fails \ud83c\udf39\n\nHandcrafted luxury bouquets delivered to their door in just 1 hour.\n\n\ud83d\udc47 Visit our profile.",
			"You don't need a reason to surprise the one you love \ud83d\udc90\n\nFloarea's luxury bouquets say what words can't \u2014 and they arrive in just 1 hour.\n\n\ud83d\udc47 Follow us.",
			"One bouquet. One hour. One unforgettable reaction \ud83c\udf38\n\nSurprise her with Floarea \u2014 luxury flowers handcrafted and delivered fast across Dubai.\n\n\ud83d\udc47 Tap our profile.",
			"She'll remember the flowers long after the moment passes \ud83c\udf39\n\nSurprise her with handcrafted luxury bouquets from Floarea. Delivered in 1 hour anywhere in Dubai.\n\n\ud83d\udc47 Follow us for more gifting ideas.",
		],
		headlines: [
			"Surprise Her With Flowers",
			"Delivered in Just 1 Hour",
			"Love, Delivered",
			"Make Someone's Day Today",
			"Luxury Flowers for the One You Love",
		],
	},
]

async function main() {
	const accessToken = process.env.META_APP_TOKEN
	if (!accessToken) {
		console.error("Missing META_APP_TOKEN")
		process.exit(1)
	}

	const client = new MetaApiClient(accessToken, "v24.0")

	for (const ad of ads) {
		console.log(`\nCreating "${ad.name}"...`)

		const thumbnails = await client.getVideoThumbnails(ad.videoId)
		const thumbnailUrl = thumbnails.data?.[0]?.uri

		const objectStorySpec = {
			page_id: PAGE_ID,
			instagram_user_id: IG_ACTOR_ID,
			video_data: {
				video_id: ad.videoId,
				message: ad.primaryTexts[0],
				title: ad.headlines[0],
				...(thumbnailUrl && { image_url: thumbnailUrl }),
				call_to_action: {
					type: "LEARN_MORE",
					value: { link: LINK_URL },
				},
			},
		}

		const assetFeedSpec: AssetFeedSpec = {
			optimization_type: "DEGREES_OF_FREEDOM",
			bodies: ad.primaryTexts.map((text) => ({ text })),
			titles: ad.headlines.map((text) => ({ text })),
			videos: [{ video_id: ad.videoId, ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }) }],
			link_urls: [{ website_url: LINK_URL }],
			call_to_action_types: ["LEARN_MORE"],
			ad_formats: ["SINGLE_VIDEO"],
		}

		const creativeParams: AdCreativeCreateParams = {
			name: `${ad.name} - Creative`,
			object_story_spec: objectStorySpec,
			asset_feed_spec: assetFeedSpec,
			url_tags: ad.urlTags,
		}

		const creative = await client.createAdCreative(ACCOUNT_ID, creativeParams)
		console.log(`  Creative: ${creative.id}`)

		const adResult = await client.createAd(ACCOUNT_ID, {
			name: ad.name,
			adset_id: AD_SET_ID,
			creative: { creative_id: creative.id },
			status: "PAUSED",
		})
		console.log(`  Ad: ${adResult.id}`)
	}

	console.log("\nDone! All 6 ads created with 5 primary texts and 5 headlines each.")
}

main()
