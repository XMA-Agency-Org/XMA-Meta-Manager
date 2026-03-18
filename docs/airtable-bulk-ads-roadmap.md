# Airtable Bulk Ads Creation System — Roadmap

Two-part system: **(A)** an Airtable base with structured tables/views, and **(B)** a Next.js web app (`xma-airtable-publisher`) that listens for webhooks and executes Meta API calls.

---

## Phase 0: Foundation & Integrations

**Goal:** Set up the Airtable base, the web app project, and all external connections.

### 0.1 — Create the Airtable Base

- Create a new Airtable base called "XMA Ad Builder" (or similar)
- Airtable Pro/Enterprise plan required for webhooks and automations

### 0.2 — Create the `xma-airtable-publisher` Next.js App

- `bun create next-app xma-airtable-publisher` (Next.js 16, App Router, TypeScript, Tailwind v4)
- Install dependencies: `airtable` SDK, `axios`, Meta Marketing API client, `zod`, `drizzle-orm`, `better-sqlite3`
- Set up env vars: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `META_APP_TOKEN`, `META_BUSINESS_ID`, `WEBHOOK_SECRET`

### 0.3 — OAuth / Account Connections

- Meta Ads: System user token or OAuth flow for ad account access
- Airtable: Personal access token or OAuth for base read/write
- Google Drive API: OAuth for file sync (creatives)
- Frame.io API: OAuth for file sync (optional)

---

## Phase 1: Reference Tables (Airtable)

These tables store reusable configuration that campaigns/adsets/ads reference via linked records.

### 1.1 — `Ad Accounts` Table

| Field              | Type                              | Notes                        |
| ------------------ | --------------------------------- | ---------------------------- |
| Account Name       | Single Line Text                  | Display name                 |
| Ad Account ID      | Single Line Text                  | `act_XXXXX`                  |
| Pixel ID           | Single Line Text                  | Auto-pulled or manual        |
| Facebook Page      | Linked Record → Pages             |                              |
| Instagram Page     | Linked Record → Pages             |                              |
| Landing Pages      | Linked Record → Landing Pages     |                              |
| Existing Campaigns | Linked Record → Existing Campaigns | Auto-synced                 |
| Existing Ad Sets   | Linked Record → Existing Ad Sets  | Auto-synced                  |

### 1.2 — `Pages` Table

| Field      | Type                          |
| ---------- | ----------------------------- |
| Page Name  | Single Line Text              |
| Page ID    | Single Line Text              |
| Type       | Single Select (Facebook / Instagram) |
| Ad Account | Linked Record → Ad Accounts   |

### 1.3 — `Landing Pages` Table

| Field      | Type                        |
| ---------- | --------------------------- |
| Name       | Single Line Text            |
| URL        | URL                         |
| Ad Account | Linked Record → Ad Accounts |

### 1.4 — `Placements` Table

| Field          | Type                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| Placement Name | Single Line Text                                                            |
| Platform       | Single Select (Facebook / Instagram / Audience Network / Messenger)         |
| Position       | Multiple Select (Feed, Stories, Reels, Right Column, Search, etc.)          |
| Device         | Single Select (Mobile / Desktop / All)                                      |
| Description    | Long Text                                                                   |

### 1.5 — `Custom Audiences` Table

| Field         | Type                                                    |
| ------------- | ------------------------------------------------------- |
| Audience Name | Single Line Text                                        |
| Audience ID   | Single Line Text                                        |
| Type          | Single Select (Website, Lookalike, Custom, etc.)        |
| Ad Account    | Linked Record → Ad Accounts                             |

**Sync strategy:** Web app pulls audiences from Meta API periodically and upserts into Airtable.

### 1.6 — `Geographic Targets` Table

| Field   | Type                                                    |
| ------- | ------------------------------------------------------- |
| Name    | Single Line Text                                        |
| Type    | Single Select (Country / State / City / Zip Code)       |
| Geo Key | Single Line Text                                        |
| Parent  | Linked Record → Geographic Targets (self-referencing)   |

### 1.7 — `Creative Enhancements` Table

| Field            | Type             |
| ---------------- | ---------------- |
| Enhancement Name | Single Line Text |
| Enhancement Key  | Single Line Text |
| Description      | Long Text        |
| Category         | Single Select    |

### 1.8 — `Existing Campaigns` Table (Auto-synced)

| Field         | Type                        |
| ------------- | --------------------------- |
| Campaign Name | Single Line Text            |
| Campaign ID   | Single Line Text            |
| Status        | Single Select               |
| Objective     | Single Select               |
| Ad Account    | Linked Record → Ad Accounts |

### 1.9 — `Existing Ad Sets` Table (Auto-synced)

| Field       | Type                                 |
| ----------- | ------------------------------------ |
| Ad Set Name | Single Line Text                     |
| Ad Set ID   | Single Line Text                     |
| Campaign    | Linked Record → Existing Campaigns   |
| Status      | Single Select                        |
| Ad Account  | Linked Record → Ad Accounts          |

---

## Phase 2: Creative Library

### 2.1 — `Creative Upload Database` Table

| Field                  | Type                        | Notes                      |
| ---------------------- | --------------------------- | -------------------------- |
| Google Drive Folder URL | URL                        | Source folder              |
| Ad Account             | Linked Record → Ad Accounts | Destination                |
| Sync Status            | Single Select (Active / Paused / Error) |                 |
| Last Synced            | Date                        | Auto-updated by web app    |

### 2.2 — `Creatives` Table

| Field               | Type                                                       | Notes                        |
| ------------------- | ---------------------------------------------------------- | ---------------------------- |
| Creative Name       | Single Line Text                                           | Filename or custom           |
| Thumbnail           | Attachment                                                 | Preview image                |
| File Type           | Single Select (Image / Video)                              |                              |
| Dimensions          | Single Line Text                                           | e.g. "1080x1920"            |
| Aspect Ratio        | Single Select (1:1, 4:5, 9:16, 16:9)                      |                              |
| Duration            | Number                                                     | Seconds (videos only)        |
| File Size           | Number                                                     | Bytes                        |
| Asset ID            | Single Line Text                                           | Meta ad account asset hash   |
| Ad Account          | Linked Record → Ad Accounts                                |                              |
| Upload Source        | Single Select (Google Drive / Frame.io / Manual)           |                              |
| Upload Date         | Date                                                       |                              |
| Google Drive File ID | Single Line Text                                          | For sync tracking            |
| Status              | Single Select (Pending / Uploaded / Error)                 |                              |

### 2.3 — Creatives Table Views

- **All Creatives** — Grid view, sorted by upload date
- **Uploaded Today** — Filtered by upload date = today
- **Upload Queue** — Filtered by status = Pending
- **Creative Gallery** — Gallery view showing thumbnails
- **By Account** — Grouped by Ad Account
- **By Aspect Ratio** — Grouped by Aspect Ratio

### 2.4 — Google Drive Sync Logic (Web App)

- Polling or webhook: Watch Google Drive folders listed in Creative Upload Database
- On new file detected → download → upload to Meta ad account via Marketing API (`POST /act_{id}/adimages` or `POST /act_{id}/advideos`)
- Write asset ID back to Creatives table
- Generate thumbnail if video

---

## Phase 3: Build Tables (Campaign → Ad Set → Ad)

Core of the system. Three hierarchical tables with a "Table Action" trigger field.

### 3.1 — `Campaigns` Table

| Field                      | Type                                                               | Notes                          |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Table Action**           | Single Select (Building / Create Campaign / Done / Error)          | **Trigger field**              |
| Campaign Status            | Single Select (Paused / Active)                                    | Upload as paused or active     |
| Campaign Type              | Single Select (Advantage Plus Shopping / Standard)                 |                                |
| Campaign Objective         | Single Select (Sales / Leads / Traffic)                            |                                |
| Special Ad Category        | Multiple Select (Credit, Employment, Housing, etc.)                |                                |
| Special Ad Category Country | Linked Record → Geographic Targets                                |                                |
| Ad Account                 | Linked Record → Ad Accounts                                       |                                |
| New Campaign Name          | Single Line Text                                                   | Or formula                     |
| Campaign Budget            | Currency                                                           | Optional (CBO)                 |
| Campaign Bid Strategy      | Single Select (Lowest Cost, Cost Cap, Bid Cap, Min ROAS)           |                                |
| Share Adset Budget         | Checkbox                                                           |                                |
| **Campaign ID**            | Single Line Text                                                   | Populated after creation       |
| **Facebook URL**           | Formula/URL                                                        | Direct link to Ads Manager     |
| Error Message              | Long Text                                                          | If creation fails              |
| Created At                 | Date                                                               | Auto-populated                 |

### 3.2 — `Ad Sets` Table

| Field                  | Type                                                               | Notes                          |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Table Action**       | Single Select (Building / Create Ad Sets / Done / Error)           | **Trigger field**              |
| Campaign               | Linked Record → Campaigns                                         | New campaign                   |
| Existing Campaign      | Linked Record → Existing Campaigns                                | Or existing                    |
| Ad Sets Per Campaign   | Number                                                             | Multiplier for bulk creation   |
| Adset Description      | Single Line Text                                                   | Part of naming convention      |
| Ad Account             | Linked Record → Ad Accounts (Lookup from Campaign)                |                                |
| Pixel                  | Lookup from Ad Account                                             |                                |
| Adset Number           | Number                                                             | Position in campaign           |
| Launch Date            | Date                                                               | Schedule start                 |
| End Date               | Date                                                               | Optional schedule end          |
| Advantage Plus Audience | Checkbox                                                          |                                |
| Include Audiences      | Linked Record → Custom Audiences                                   |                                |
| Exclude Audiences      | Linked Record → Custom Audiences                                   |                                |
| Min Age                | Number                                                             | 18-65                          |
| Max Age                | Number                                                             | 18-65                          |
| Gender                 | Single Select (All / Male / Female)                                |                                |
| Countries              | Linked Record → Geographic Targets                                 |                                |
| States                 | Linked Record → Geographic Targets                                 |                                |
| Cities                 | Linked Record → Geographic Targets                                 |                                |
| Exclude States         | Linked Record → Geographic Targets                                 |                                |
| Exclude Cities         | Linked Record → Geographic Targets                                 |                                |
| Zip Codes              | Long Text                                                          | Comma-separated                |
| Placement              | Linked Record → Placements                                         |                                |
| Adset Budget           | Currency                                                           | ABO budget                     |
| Adset Bid              | Currency                                                           | If bid strategy requires       |
| Min Daily Spend        | Currency                                                           | For CBO spend forcing          |
| Max Daily Spend        | Currency                                                           |                                |
| Click Attribution      | Single Select (7-day / 1-day)                                      |                                |
| View Attribution       | Single Select (None / 1-day)                                       |                                |
| Engaged View           | Single Select (None / 1-day)                                       |                                |
| Bid Strategy           | Single Select (Lowest Cost, Cost Cap, Min ROAS, Bid Cap)           |                                |
| Attribution Setting    | Single Select (Standard / Incremental)                             |                                |
| **Final Adset Name**   | Formula                                                            | description + date + age + gender + number |
| **Adset ID**           | Single Line Text                                                   | Populated after creation       |
| **Facebook URL**       | Formula/URL                                                        | Direct link to ad set          |
| Error Message          | Long Text                                                          |                                |

### 3.3 — `Ads` Table

| Field                    | Type                                                         | Notes                          |
| ------------------------ | ------------------------------------------------------------ | ------------------------------ |
| **Table Action**         | Single Select (Building / Create Ads / Done / Error)         | **Trigger field**              |
| Ad Set                   | Linked Record → Ad Sets                                      |                                |
| Ads Per Adset            | Number                                                       | Multiplier for bulk creation   |
| Ad Account               | Lookup from Ad Set chain                                     |                                |
| Facebook Page            | Linked Record → Pages                                        |                                |
| Instagram Page           | Linked Record → Pages                                        |                                |
| **Select Creative**      | Linked Record → Creatives                                    | Main creative (1:1 or single)  |
| Story/Reel Creative      | Linked Record → Creatives                                    | 9:16 asset customization       |
| Feed Creative            | Linked Record → Creatives                                    | 1:1 or 4:5 asset customization |
| Landing Page             | Linked Record → Landing Pages                                |                                |
| **Final Ad Name**        | Formula                                                      | Customizable naming convention |
| Post Text 1             | Long Text                                                     | Primary text variation 1       |
| Post Text 2             | Long Text                                                     | Primary text variation 2       |
| Post Text 3             | Long Text                                                     | Primary text variation 3       |
| Post Text 4             | Long Text                                                     | Primary text variation 4       |
| Post Text 5             | Long Text                                                     | Primary text variation 5       |
| Headline 1              | Single Line Text                                              |                                |
| Headline 2              | Single Line Text                                              |                                |
| Headline 3              | Single Line Text                                              |                                |
| Headline 4              | Single Line Text                                              |                                |
| Headline 5              | Single Line Text                                              |                                |
| Link Description         | Long Text                                                    |                                |
| CTA                     | Single Select (Learn More, Shop Now, Sign Up, etc.)           |                                |
| URL Tags                | Long Text                                                     | UTMs or custom params          |
| Creative Enhancements    | Linked Record → Creative Enhancements                        |                                |
| Multi-Advertiser         | Checkbox                                                     |                                |
| Use Existing Post ID     | Single Line Text                                             | For reusing social proof       |
| **Ad ID**               | Single Line Text                                              | Populated after creation       |
| **Facebook URL**        | Formula/URL                                                   | Direct link to ad              |
| Error Message            | Long Text                                                    |                                |

---

## Phase 4: Web App — Webhook Listener & Meta API Executor

The `xma-airtable-publisher` Next.js app that does the heavy lifting.

### 4.1 — Architecture

```
xma-airtable-publisher/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── airtable/route.ts       # Airtable webhook receiver
│   │   │   ├── sync/
│   │   │   │   ├── campaigns/route.ts       # Sync existing campaigns from Meta
│   │   │   │   ├── adsets/route.ts          # Sync existing ad sets
│   │   │   │   ├── audiences/route.ts       # Sync custom audiences
│   │   │   │   └── creatives/route.ts       # Google Drive → Meta creative sync
│   │   │   ├── create/
│   │   │   │   ├── campaign/route.ts        # Create campaign on Meta
│   │   │   │   ├── adset/route.ts           # Create ad set on Meta
│   │   │   │   └── ad/route.ts              # Create ad on Meta
│   │   │   └── cron/
│   │   │       ├── sync-drive/route.ts      # Periodic Google Drive polling
│   │   │       └── sync-accounts/route.ts   # Periodic Meta data sync
│   │   └── page.tsx                         # Dashboard/status page
│   ├── lib/
│   │   ├── airtable.ts                      # Airtable SDK wrapper
│   │   ├── meta-api.ts                      # Meta Marketing API helpers
│   │   ├── google-drive.ts                  # Google Drive API client
│   │   ├── webhook-handler.ts               # Parse & route webhook events
│   │   └── payload-builders/
│   │       ├── campaign.ts                  # Build Meta campaign payload from Airtable row
│   │       ├── adset.ts                     # Build Meta adset payload
│   │       └── ad.ts                        # Build Meta ad payload (incl. ad creative)
│   └── types/
│       ├── airtable.ts                      # Row types per table
│       └── meta-api.ts                      # Meta API request/response types
```

### 4.2 — Webhook Flow (Core Logic)

```
Airtable Table Action changed →
  Airtable Automation triggers webhook →
    POST /api/webhooks/airtable
      {
        table: "Campaigns" | "Ad Sets" | "Ads",
        action: "Create Campaign" | "Create Ad Sets" | "Create Ads",
        recordIds: ["recXXX", "recYYY", ...]
      }
    →
    For each record:
      1. Read full record + linked records from Airtable
      2. Resolve all linked references (ad account, audiences, placements, etc.)
      3. Build Meta API payload
      4. Call Meta Marketing API
      5. Write back result to Airtable (ID, status, error message)
      6. If Ad Sets: auto-create child Ad rows (one per ad set)
      7. If Campaigns: auto-create child Ad Set rows
```

### 4.3 — Airtable Automations (Configured Inside Airtable)

For each build table (Campaigns, Ad Sets, Ads):

- **Trigger:** When `Table Action` field changes to `Create Campaign` / `Create Ad Sets` / `Create Ads`
- **Action:** Send webhook to `https://your-app.vercel.app/api/webhooks/airtable` with:
  - Table name
  - Action type
  - Record ID(s) where action changed
  - HMAC signature for verification

### 4.4 — Bulk Row Creation Logic

When "Ad Sets Per Campaign" = 50:

1. Airtable automation triggers on "Create Ad Sets"
2. Web app reads the template row
3. Web app creates 49 duplicate rows in Airtable (via Airtable API) with incremented adset numbers
4. Processes all 50 rows → creates 50 ad sets on Meta
5. Auto-creates corresponding Ad rows (one per ad set) in the Ads table

Same pattern for "Ads Per Adset" multiplier.

---

## Phase 5: Creative Sync Pipeline

### 5.1 — Google Drive → Meta Flow

```
Cron job (every 5-15 min) →
  Read Creative Upload Database table →
  For each active sync row:
    1. List files in Google Drive folder
    2. Compare against existing Creatives table entries (by Google Drive File ID)
    3. For new files:
       a. Download from Google Drive
       b. Upload to Meta ad account (adimages/advideos endpoint)
       c. Get asset hash/ID
       d. Create row in Creatives table with thumbnail, metadata, asset ID
    4. Update "Last Synced" timestamp
```

### 5.2 — Manual Upload

- Allow direct attachment upload in Creatives table
- Web app watches for rows with attachments but no Asset ID → uploads to Meta

---

## Phase 6: Reporting Views

### 6.1 — `Top Ad Copy` Table/View

| Field           | Type     |
| --------------- | -------- |
| Ad Copy Text    | Long Text |
| Usage Count     | Rollup (count of ads using this text) |
| Spend Last 7d   | Currency |
| ROAS Last 7d    | Number   |
| Spend Last 30d  | Currency |
| ROAS Last 30d   | Number   |
| Spend YTD       | Currency |
| ROAS YTD        | Number   |
| CPA Last 7d     | Currency |
| CTR Last 7d     | Percent  |

### 6.2 — `Top Ads` View (on Ads table)

- Filtered to status = Active, sorted by performance metrics
- Shows Post ID (for reuse), creative thumbnail, spend, ROAS, CPA
- **Facebook URL** field for quick navigation

### 6.3 — Reporting Sync (Web App)

- Daily cron: Pull ad insights from Meta Insights API
- Aggregate by ad copy text across all ads
- Write/update reporting data back to Airtable

---

## Phase 7: Deployment & Operations

| Step             | Details                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| **Host**         | Deploy `xma-airtable-publisher` to Vercel (Next.js native)             |
| **Cron Jobs**    | Vercel Cron or external (e.g., Trigger.dev) for Drive sync + reporting |
| **Webhook URL**  | Vercel production URL → Airtable automations                           |
| **Monitoring**   | Error logging + Airtable error status fields                           |
| **Rate Limiting** | Queue system for bulk Meta API calls (50+ ad sets) — use a job queue like BullMQ or Inngest |

---

## Build Order (Recommended)

| Order | Phase                                                                          | Scope             |
| ----- | ------------------------------------------------------------------------------ | ------------------ |
| 1     | **Phase 0** — Project setup, env vars, Airtable base creation                 | Foundation         |
| 2     | **Phase 1** — Reference tables (manual data entry first)                      | Airtable config    |
| 3     | **Phase 3.1** — Campaign build table + webhook + Meta campaign creation       | First E2E flow     |
| 4     | **Phase 3.2** — Ad Set build table + bulk row creation + Meta ad set creation | Core feature       |
| 5     | **Phase 3.3** — Ad build table + creative linking + Meta ad creation          | Core feature       |
| 6     | **Phase 2** — Creative library + Google Drive sync                            | Automation layer   |
| 7     | **Phase 4.4** — Bulk multiplier logic (N ad sets per campaign, N ads per ad set) | Scale feature   |
| 8     | **Phase 5** — Auto-sync existing campaigns/adsets/audiences from Meta         | Data sync          |
| 9     | **Phase 6** — Reporting views + insights sync                                 | Analytics          |
| 10    | **Phase 7** — Production deployment, monitoring, rate limit handling          | Operations         |

---

## Key Decisions Before Starting

1. **Airtable webhook method:** Airtable's built-in Automations (simpler) vs. Airtable Webhooks API (more control)?
2. **Job queue for bulk operations:** Vercel serverless has 10s/60s timeouts. Creating 50 ad sets sequentially will hit that. Options: Inngest, Trigger.dev, or a simple queue-and-poll pattern.
3. **Google Drive sync frequency:** Real-time (Drive push notifications) vs. polling (every 5-15 min)?
4. **Multi-tenant or single tenant?** One Airtable base per client, or one base with multiple ad accounts?
5. **Where does this live relative to XMA-Meta-Manager?** Separate standalone service, or integrated into the existing app?
