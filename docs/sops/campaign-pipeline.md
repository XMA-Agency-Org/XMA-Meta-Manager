# Campaign Pipeline SOP

Config-driven pipeline for creating Meta ad campaigns from YAML files.

## Prerequisites

1. **Environment variables** in `.env.local`:
   - `META_APP_TOKEN` — Meta Marketing API access token with `ads_management` permission
   - `META_BUSINESS_ID` — Meta business account ID

2. **Bun** installed globally

3. **Ad account ID** — starts with `act_`, found in Meta Business Settings

## Workflow

### 1. Create a Campaign Folder

```bash
mkdir -p campaigns/my-campaign/creatives
```

### 2. Add Creative Files

Drop images (.jpg, .jpeg, .png, .gif, .webp) and videos (.mp4, .mov) into `campaigns/my-campaign/creatives/`.

### 3. Write config.yaml

Create `campaigns/my-campaign/config.yaml`. Reference the example at `campaigns/example/config.yaml`.

**Key fields:**

| Field | Description |
|-------|-------------|
| `version` | Always `1` |
| `adAccountId` | Your Meta ad account ID (`act_XXXXX`) |
| `campaign` | New campaign definition (or use `existingCampaignId`) |
| `adSets` | Array of ad set definitions with targeting |
| `ads` | Array of ad definitions with creative specs |

**Refs:** Each entity has a `ref` field (arbitrary name). Ad sets reference campaigns via `campaignRef`, ads reference ad sets via `adSetRef`. These are resolved at runtime to actual Meta IDs.

**Budgets:** Specified in cents (e.g., `5000` = $50.00).

**Using an existing campaign:** Replace the `campaign` block with `existingCampaignId: "120XXXXXXXXX"`.

### 4. Dry Run

Preview what will be created without making API calls:

```bash
bun scripts/meta/run-pipeline.ts campaigns/my-campaign/config.yaml --dry-run
```

This validates the config, checks creative files exist, and prints a summary.

### 5. Execute

```bash
bun scripts/meta/run-pipeline.ts campaigns/my-campaign/config.yaml
```

The pipeline:
1. Validates the config
2. Uploads creative files to Meta
3. Creates the campaign (unless using existing)
4. Creates ad sets sequentially
5. Creates ad creatives and ads sequentially
6. Writes `_result.yaml` with all created Meta IDs

### 6. Check Results

Open `campaigns/my-campaign/_result.yaml` to see:
- All created Meta entity IDs
- Ads Manager URL for the campaign
- Asset hashes for uploaded creatives

### 7. Verify in Ads Manager

Open the Ads Manager URL from `_result.yaml` to confirm:
- Campaign settings (objective, budget, bid strategy)
- Ad set targeting (geo, age, gender, placements)
- Ad creatives (images/videos, copy, CTA, landing page)

All entities are created as **PAUSED** by default — activate manually when ready.

## Standalone Creative Upload

Upload creatives without creating a campaign:

```bash
bun scripts/meta/upload-creatives.ts --account act_XXXXX --dir ./campaigns/my-campaign/creatives/
```

Prints filename-to-asset-ID mapping for use in config files.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Missing META_APP_TOKEN` | Set in `.env.local` or export before running |
| `Config file not found` | Check path is correct and file exists |
| `Missing creative files` | Ensure files are in `creatives/` folder next to config |
| `Unresolved ref` | Check that `campaignRef`/`adSetRef` match defined `ref` values |
| `MetaApiError: Invalid parameter` | Check field values match Meta API requirements (e.g., valid objective, budget in cents) |
| `Rate limited` | Pipeline retries automatically up to 3 times with exponential backoff |
| `Partial failure` | Check `_result.yaml` for what was created. Re-run after fixing the issue — already-created entities won't be duplicated if you update the config |

## Config Reference

See `lib/pipeline/config-schema.ts` for the complete Zod schema with all available fields and their types.
