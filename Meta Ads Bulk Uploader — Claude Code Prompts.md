# [**Join 250+ Agencies & Brands**](https://go.mikefutia.com/scale-lm-delivery) 

# [**Inside SCALE AI**](https://go.mikefutia.com/scale-lm-delivery)

# 

# **Meta Ads Bulk Uploader — Claude Code Prompts**

Every prompt I used to vibe-code a Meta Ads Bulk Uploader from scratch. Copy these into Claude Code in order and you'll have a working app that uploads dozens of ads through Meta's API in minutes.

**Stack:** Next.js, React, Tailwind CSS, PostgreSQL, Drizzle ORM, Meta Marketing API v22.0

**Deploy:** Replit (free tier works) or run locally

---

## **Prompt 1: Project Setup**

```
Create a new Next.js app with TypeScript and Tailwind CSS. Use the app router. Set it up with a dark theme (zinc/slate color palette). Add Drizzle ORM with PostgreSQL support. The app is called "Meta Ads Bulk Uploader" — it lets media buyers upload dozens of Facebook/Instagram ads at once through Meta's Marketing API instead of doing it one by one in Ads Manager.
```

## **Prompt 2: Database Schema**

```
Create the database schema with Drizzle ORM. I need three tables:

1. settings — stores the user's Meta access token, selected ad account ID/name, and selected Facebook page ID/name
2. upload_batches — stores each upload session with: batch name, campaign ID/name, ad set ID/name, arrays of primary texts/headlines/descriptions, CTA type, website URL, display link, launch as paused toggle, enhancements enabled toggle, status (draft/uploading/complete/error), counts for ads created and errored, and an error log array
3. creatives — each uploaded file linked to a batch, with: file name, file type (image/video), mime type, file path, file size, thumbnail path for videos, auto-generated ad name, Meta ad ID and creative ID (filled after creation), status, and error message

Add timestamps where appropriate. Use jsonb for the array fields.
```

## **Prompt 3: App Layout with Sidebar**

```
Create a layout with a fixed sidebar on the left. The sidebar should have the app name "Meta Ads" with "Bulk Uploader" underneath, then three nav links: Upload Ads (📤), History (📋), and Settings (⚙️). Show an active indicator on the current page. At the bottom of the sidebar show "Meta Marketing API v22.0". Use the dark zinc theme — the sidebar should be slightly darker than the main content area.
```

## **Prompt 4: Settings Page**

```
Build the Settings page. It needs:

1. A password input field for the Meta access token. If a token is already saved, show a preview of the last 8 characters. When a new token is saved, immediately fetch and display available ad accounts and Facebook pages.
2. A dropdown to select an ad account (show name, account ID, and currency)
3. A dropdown to select a Facebook page (ads get published from this page)
4. A save button that persists everything to the database

Create API routes for:
- GET/POST /api/settings — load and save settings
- GET /api/meta/accounts — fetch ad accounts from Meta using the saved token
- GET /api/meta/pages — fetch Facebook pages the token has access to

Use the Meta Graph API v22.0 base URL. The accounts endpoint is /me/adaccounts with fields id,name,account_id,account_status,currency. The pages endpoint is /me/accounts with fields id,name.
```

## **Prompt 5: Meta API Helper Functions**

```
Create a meta-api.ts utility file with these functions:

1. metaGet(endpoint, accessToken, params) — generic GET request to the Meta Graph API
2. metaPost(endpoint, accessToken, body) — generic POST with JSON body, includes the access token in the body. On error, extract the error_user_msg or error.message from Meta's error response.
3. getAdAccounts(accessToken) — fetch all ad accounts
4. getCampaigns(adAccountId, accessToken) — fetch campaigns for an ad account with id, name, status, objective
5. getAdSets(campaignId, accessToken) — fetch ad sets for a campaign
6. getAdSetDetails(adSetId, accessToken) — get full ad set details including targeting, billing_event, optimization_goal, bid settings, budgets, promoted_object, destination_type, attribution_spec
7. createAdSet(adAccountId, accessToken, {name, campaignId, sourceAdSetId}) — create a new ad set by copying all settings from an existing one. Set status to PAUSED.
8. uploadImageToMeta(adAccountId, accessToken, imageBuffer, fileName) — upload image using multipart form data to /{adAccountId}/adimages. Auto-convert WebP/BMP/TIFF to JPEG using sharp. Return the image hash.
9. uploadVideoToMeta(adAccountId, accessToken, videoBuffer, fileName) — upload video to /{adAccountId}/advideos. Return the video ID.
10. createAdCreative — this is the complex one. See next prompt.
11. createAd(adAccountId, accessToken, {name, adSetId, creativeId, status}) — create the actual ad
12. getPages(accessToken) — fetch Facebook pages
```

## **Prompt 6: Ad Creative Creation Logic**

```
The createAdCreative function needs to handle two cases:

CASE 1 — Multiple text variations (more than 1 primary text, headline, or description):
Use asset_feed_spec format. Structure it with bodies, titles, descriptions arrays (each item is {text: "..."}), call_to_action_types array, link_urls array. For images, include images: [{hash}] with ad_formats: ["SINGLE_IMAGE"]. For videos, include videos: [{video_id, thumbnail_url}] with ad_formats: ["SINGLE_VIDEO"]. Wrap it in object_story_spec with just the page_id.

CASE 2 — Single text variation:
For images, use object_story_spec.link_data with image_hash, link, message (primary text), name (headline), description, call_to_action {type}, and optional caption (display link).
For videos, use object_story_spec.video_data with video_id, message, title, link_description, call_to_action {type, value: {link}}, and optional image_url for thumbnail.

Post to /{adAccountId}/adcreatives.
```

## **Prompt 7: File Upload API**

```
Create a POST /api/upload route that:
1. Accepts multipart form data with a batchId and multiple files
2. Saves each file to an uploads/{batchId}/ directory
3. Sanitizes filenames (replace non-alphanumeric chars with underscores)
4. Detects whether each file is an image or video based on mime type
5. Auto-generates an ad name from the filename (without extension)
6. Inserts a record into the creatives table for each file
7. Returns the array of created creative records
```

## **Prompt 8: Upload Page — Step 1 (File Upload)**

```
Build the main upload page as a 3-step wizard: "Upload Creatives" → "Ad Copy & URL" → "Campaign & Launch". Show a step indicator at the top with numbered circles — completed steps show a checkmark in green, current step is blue, future steps are gray.

Step 1:
- A text input for "Batch Name" (default to "Batch {today's date}")
- A drag-and-drop zone for images and videos. Accept image/* and video/*. Show a folder icon, "Drag & drop images or videos" text, format hints, and a "Browse Files" button.
- Below the drop zone, show the list of selected files with an icon (📹 for video, 🖼️ for image), filename, file size in MB, and a remove button
- An upload button that creates the batch via API, uploads all files, then advances to step 2
```

## **Prompt 9: Upload Page — Step 2 (Ad Copy)**

```
Step 2 of the wizard:

Show a summary card of uploaded creatives at the top. For each creative, show the file type icon, filename, an editable ad name input, and for videos a "+ Thumb" button to upload a custom thumbnail (shows "✓ Thumb" after upload).

Below that, card sections for:
- Primary Text — textarea fields with "+ Add variation" button (up to 5). Note: "Meta rotates them automatically"
- Headlines — input fields with "+ Add variation"
- Descriptions — input fields with "+ Add variation"
- Destination & CTA — website URL (required), display link (optional), and a dropdown for CTA type with these options: LEARN_MORE, SHOP_NOW, SIGN_UP, SUBSCRIBE, GET_OFFER, ORDER_NOW, BOOK_NOW, CONTACT_US, DOWNLOAD, GET_QUOTE, APPLY_NOW, BUY_NOW, WATCH_MORE, SEE_MENU, SEND_MESSAGE, GET_STARTED

Each variation field group should have remove buttons (except when there's only one). Validate that at least one primary text, one headline, and the URL are filled before advancing.

Create API routes for:
- PUT /api/creative — update ad name
- POST /api/creative/thumbnail — upload a thumbnail for a video creative
```

## **Prompt 10: Upload Page — Step 3 (Campaign Selection)**

```
Step 3:

Campaign dropdown — fetch campaigns from /api/meta/campaigns when this step loads. Show campaign name and status.

Ad Set section — when a campaign is selected, fetch its ad sets. Two modes:
1. "Use existing ad set" — simple dropdown
2. "Create new ad set" — toggled via a link. Shows a dropdown to pick a source ad set to copy settings from, a text input for the new name, and a create button. After creation, auto-select the new ad set and switch back to the dropdown view.

Include a note: "Dynamic Creative ad sets only allow 1 ad — use Create new ad set for bulk uploads."

Launch Options:
- Checkbox: "Launch as paused" (default checked) with note "Review in Ads Manager before activating"
- Checkbox: "Enable creative enhancements" (default unchecked) with note "Meta AI auto-adjusts your creative"

Summary card showing: number of creatives, text variation counts, CTA, URL, enhancements status, launch status.

Create the campaign and ad set API routes:
- GET /api/meta/campaigns — uses saved settings to fetch campaigns
- GET /api/meta/adsets?campaignId=X — fetch ad sets for a campaign
- POST /api/meta/adsets — create a new ad set (takes name, campaignId, sourceAdSetId)
```

## **Prompt 11: Launch Logic**

```
Create POST /api/launch route. Given a batchId:

1. Validate everything is configured (token, ad account, page, ad set, URL, texts)
2. Fetch all creatives for the batch
3. Update batch status to "uploading"
4. For each creative:
   a. Read the file from disk
   b. Upload to Meta (image → adimages endpoint for hash, video → advideos endpoint for video ID)
   c. If it's a video with a custom thumbnail, upload that image too
   d. Create an ad creative using the uploaded media + the batch's copy settings
   e. Create the ad in the selected ad set
   f. Update the creative record with Meta IDs and "created" status
   g. On error, log it and mark the creative as "error"
5. Update batch with final counts and status ("complete" or "error" if all failed)
6. Return the results with adsCreated, adsErrored, and errorLog

Show the results on the page — green card for success, warning card if there were errors. Show error details. On success, show an "Upload Another Batch" button that resets the wizard.
```

## **Prompt 12: History Page**

```
Build the History page. Fetch all upload batches sorted by newest first. Show each batch as a card with: batch name, campaign → ad set path, timestamp, ads created count (green), errors count (red), and a status badge (complete = green, error = red, uploading = amber, draft = gray). If no batches exist, show an empty state with a link to upload the first batch.

Create GET /api/batch to return all batches, and also add GET /api/batch/[id]/creatives to return creatives for a specific batch.
```

## **Prompt 13: Batch Management API**

```
Add PUT /api/batch to save batch settings (campaign, ad set, copy, CTA, URL, launch options). This gets called when the user moves to step 3 and when they hit launch. Also make sure POST /api/batch creates a new batch record and returns it.
```

## **Prompt 14: Settings Check on Load**

```
On the main upload page, check if settings are configured (token exists, ad account selected) when the page loads. If not, show a "Setup Required" message with a link to the Settings page instead of the upload wizard. This prevents users from uploading files before connecting their Meta account.
```

## **Prompt 15: WebP Auto-Conversion**

```
In the image upload function, auto-detect if the image is WebP, BMP, or TIFF format. If so, convert it to JPEG using the sharp library before uploading to Meta. Meta doesn't accept WebP for ad images. Rename the file extension to .jpg in the upload.
```

## **Prompt 16: Error Handling Polish**

```
Go through all API routes and make sure Meta API errors bubble up with useful messages. Meta returns errors in {error: {message, error_user_msg, error_data}}. Prefer error_user_msg when available (it's more readable), fall back to message, and append error_data if present. These error messages should make it to the UI so users can debug issues themselves.
```

## **Prompt 17: Replit Configuration**

```
Add a .replit file and replit.nix for Replit deployment. The app should:
- Install Node.js 22 and PostgreSQL in replit.nix
- Use port 3000 for production, port 5000 for dev
- Build command: npm run build
- Run command: npm run start -- -p 3000
- Add a db:push script to package.json that runs drizzle-kit push

Make sure the README has instructions for both Replit import and local setup.
```

## **Prompt 18: Meta App Setup Guide**

```
Create a META-APP-SETUP.md file with step-by-step instructions for setting up a Meta developer app. This is the thing most people will get stuck on. Cover:

1. Creating an app at developers.facebook.com (Business type)
2. Connecting it to a Business Manager
3. Adding the "Create & manage ads" use case
4. Creating a System User token with ads_management, ads_read, business_management, pages_show_list permissions
5. Adding a Privacy Policy URL (a Google Doc works)
6. Publishing the app (it MUST be in Live mode to create ads — this is the #1 gotcha)
7. Where to paste the token in the app

Emphasize that Development mode will NOT work for creating ads. The app must be published.
```

## **Prompt 19: README**

```
Write a README.md for the GitHub repo. Include:
- One-line description: "Upload dozens of Facebook/Instagram ads in minutes instead of hours"
- Feature list with emoji bullets
- Quick start for both Replit and local
- Big warning about Meta app needing to be published (Live mode)
- Tech stack
- Link to Scale AI on Skool for support

Keep it clean and scannable. This is a free tool — mention that up front.
```

## **Prompt 20: Final Polish**

```
Do a final pass on the UI:
- Make sure all loading states show spinners or "Loading..." text
- Disabled buttons should have reduced opacity and not-allowed cursor
- The step indicator should feel satisfying — green checkmarks for completed steps
- File size should show in MB with one decimal
- Timestamps in history should use toLocaleString
- Empty states should have friendly copy and obvious next actions
- The entire app should feel fast and clean on dark backgrounds
```

---

## **Setup Checklist**

Before you run the app:

1. **Meta Developer Account** — [developers.facebook.com](https://developers.facebook.com)  
2. **Create an App** → Business type → Connect your Business Manager  
3. **Add "Create & manage ads"** use case  
4. **System User Token** with permissions: ads\_management, ads\_read, business\_management, pages\_show\_list  
5. **Add a Privacy Policy URL** (Google Doc is fine)  
6. **PUBLISH THE APP** — This is the \#1 mistake. Development mode cannot create ads.  
7. **Deploy** — Import the GitHub repo into Replit or run locally with PostgreSQL  
8. **Settings page** — Paste your token, select your ad account and page  
9. **Upload ads** — Drag, drop, configure, launch

---

