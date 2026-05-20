# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XMA Meta Manager — a Next.js 16 app + CLI pipeline for agency management of Meta ad campaigns. The primary workflow today is a YAML config-driven pipeline that creates full Meta campaigns (campaign → ad sets → ads) from the command line, with optional PostgreSQL persistence. The web dashboard is scaffolded but minimal (redirects to `/overview`).

## Commands

```bash
bun run dev          # Start dev server (Turbopack)
bun run build        # Production build
bun run lint         # Biome check
bun run format       # Biome format
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run Drizzle migrations
bun run db:studio    # Open Drizzle Studio GUI
```

### Campaign Pipeline CLI

```bash
bun scripts/meta/run-pipeline.ts <config.yaml> [--dry-run]
bun scripts/meta/upload-creatives.ts --account act_XXX --dir ./path/
bun scripts/meta/list-pages.ts --token <token>
```

Always use `bun`, never `npm`.

## Architecture

- **App Router** — `app/` at project root (no `src/` directory)
- **Path alias** — `@/*` maps to `./*` (project root) in tsconfig
- **Providers** — `components/providers.tsx` wraps the app (add QueryClientProvider, context providers here)
- **API routes** — server-side only for Meta API calls and mutations (keep secrets out of client)
- **Data fetching** — TanStack Query + axios on client, route handlers on server

### Locality of Behavior

Co-locate feature-specific code with routes using underscore-prefixed folders:
```
app/(dashboard)/generate/
  _components/
  _hooks/
  _lib/
  _types/
  page.tsx
```

Only truly shared code (design system, layout, providers) goes in root-level `components/`, `lib/`, `hooks/`, `types/`.

### Meta API Client

**`lib/meta-api.ts`** — Axios-based `MetaApiClient` class. Constructor takes `(accessToken, apiVersion = "v21.0")`. Provides campaign/adset/ad/creative CRUD, image/video upload via `form-data` package, and rate limit retry with exponential backoff (1s base, 4^attempt multiplier, max 3 retries). Throws `MetaApiError` with code/subcode/type/fbtrace. Used by both web route handlers and CLI pipeline.

### Pipeline System (`lib/pipeline/`)

YAML config-driven CLI for creating entire Meta ad campaigns:

1. **Load & validate** — `config-loader.ts` parses YAML, validates with Zod (`config-schema.ts`), verifies creative files exist, validates ref chains
2. **Upload creatives** — `creative-uploader.ts` detects media type by extension, caches existing asset IDs from `_result.yaml` to avoid re-uploads
3. **Create entities** — `campaign-creator.ts` → `adset-creator.ts` → `ad-creator.ts` (with `adCreative` creation inline)
4. **Persist results** — `result-writer.ts` writes `_result.yaml`; `db/persist.ts` inserts into PostgreSQL (if `DATABASE_URL` set)

**Ref system:** Each config entity has a `ref` (arbitrary name). Ad sets reference campaigns via `campaignRef`, ads reference ad sets via `adSetRef`. `PipelineContext` (`context.ts`) resolves refs to Meta IDs at runtime.

**Re-run support:** Pipeline reads existing `_result.yaml` to skip already-created ad sets, ads, and already-uploaded creatives. If a run fails partway through, re-running will resume from where it left off. **Important:** Meta's API "delete" only archives entities — archived ad set IDs cached in `_result.yaml` will cause "Archived Ad Sets may only contain archived or deleted Ads" errors. Always clean `_result.yaml` of deleted/archived entity refs before re-running.

**Multiple text optimization:** When an ad has multiple `primaryTexts` or `headlines`, the pipeline builds an `AssetFeedSpec` with `optimization_type: "DEGREES_OF_FREEDOM"` (Advantage+ Creative). This is **NOT** Dynamic Creative Optimization (DCO) — no `is_dynamic_creative` flag on the ad set, no 1-ad-per-ad-set limit. The full `object_story_spec` (with link/image/video data) is always required alongside `asset_feed_spec`. DCO (`is_dynamic_creative: true`) is a separate Meta feature with stricter constraints and should not be used.

**Carousel ads:** When an ad's creative has `slides` (array of `{file, headline?}`, min 2) instead of `file`, it's a carousel. The pipeline builds `object_story_spec.link_data.child_attachments` with per-slide `image_hash`, `link`, `name` (headline), and `call_to_action`. `multi_share_end_card` is set to `false`. Carousel ads cannot have both `file` and `slides`. Slide headlines fall back to the ad-level `headlines` array by index. **Important:** Carousel `asset_feed_spec` only supports `bodies` (primary texts) — `titles` are not allowed. Per-slide headlines go in `child_attachments[].name` instead. **Important:** The `call_to_action` must also be set at the top-level `link_data` — not just on individual `child_attachments`. Without the top-level CTA, Meta will not show a CTA button on the carousel ad.

**Campaign folders:** `campaigns/<client>/<campaign>/config.yaml` + `campaigns/<client>/<campaign>/creatives/` for media files. Campaigns are organized by client (e.g., `campaigns/floarea/mothers-day/`).

### Database Layer (`db/`)

Drizzle ORM + PostgreSQL (via `postgres` package). Three tables for pipeline result persistence:

- `pipeline_executions` — one row per pipeline run (status, config snapshot as jsonb, timing)
- `pipeline_entities` — campaigns, ad sets, ad creatives, ads created (FK → executions, cascade delete)
- `pipeline_assets` — uploaded creative files with `(adAccountId, filename)` index for cache lookups

`db/index.ts` exports `null` when `DATABASE_URL` is unset — pipeline works without a database. `db/persist.ts` wraps all inserts in a transaction and catches errors. The executor also wraps `persistPipelineResult` calls in try/catch as a safety net — DB failures never kill the pipeline.

## Stack & Tooling

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | React 19 |
| Styling | Tailwind CSS v4 (`@theme` inline in `globals.css`, no tailwind.config) |
| Components | CVA (class-variance-authority) for primitives |
| Icons | Lucide React |
| State | TanStack React Query v5 |
| HTTP | Axios |
| DB | Drizzle ORM + PostgreSQL (postgres.js) |
| AI | Anthropic Claude SDK |
| Images | Sharp (server-side only) |
| Validation | Zod v4 (`import { z } from "zod/v4"`, not `"zod"`) |
| Config | YAML (`yaml` package) |
| File Upload | `form-data` package (required for Bun + axios multipart) |
| Linting | Biome (replaces ESLint) |

## Code Style (Biome)

- Tabs for indentation
- Double quotes
- No semicolons
- 100-character line width
- Avoid comments — use expressive function and variable names

## CSS Rules

- **All colors in oklch** — never hex or rgb
- Design tokens defined in `app/globals.css` via `@theme inline`
- Semantic color scales: primary (250°), neutral (265°), success (155°), warning (85°), error (25°) — each with 50–950 steps
- Surface, border, sidebar, and input tokens available
- Never use `overflow: hidden` with sticky positioning
- No ambient glow decorations

## Component Patterns

- Build primitive components (Button, Link, Input, etc.) with CVA in `components/`
- Use `clsx` + `tailwind-merge` via a `cn()` utility for class merging
- Componentize aggressively — pages should not be long files

## Environment Variables

Required in `.env.local`:
- `META_APP_TOKEN` — Meta Marketing API access token
- `META_BUSINESS_ID` — Meta business account ID
- `ANTHROPIC_API_KEY` — Claude API key
- `DATABASE_URL` — PostgreSQL connection string (optional; pipeline persists results when set)

## Key Conventions

- Next.js 16: route handler `params` is a Promise — must be awaited
- Meta API calls must stay server-side (route handlers via `lib/meta-api.ts`)
- File uploads for Meta use `form-data` package with `fs.createReadStream` (not native `FormData`/`Blob` — incompatible with axios in Bun)
- Multiple text/headline options use `asset_feed_spec` with `optimization_type: "DEGREES_OF_FREEDOM"` — this is Advantage+ Creative, NOT DCO. Always include full `object_story_spec` alongside it. Do NOT set `is_dynamic_creative: true` on ad sets.
- Meta API "delete" only archives entities (sets status to DELETED) — archived IDs remain valid but unusable for new child entities. `is_dynamic_creative` is immutable after ad set creation.
- **Attribution standard:** Every ad set must include `attributionSpec` with 7-day click / 1-day view (`CLICK_THROUGH` 7, `VIEW_THROUGH` 1). Attribution and pixel are immutable after ad set creation — getting them wrong requires recreating the entire campaign.
- Pipeline budgets are in cents (e.g., `5000` = $50.00)
- All pipeline-created entities default to `PAUSED` status
- **Placement default:** Always target iOS only (`publisher_platforms: ["instagram"]`, `device_platforms: ["mobile"]`, `user_os: ["iOS"]`, `instagram_positions: ["stream","story","reels"]`). Never include Facebook placements unless explicitly requested.
- Zod v4 requires `import { z } from "zod/v4"` (not `"zod"`)
- `next.config.ts` lists `sharp` in `serverExternalPackages`

## MCP Server

Route: `app/api/[transport]/route.ts` — `mcp-handler` stateless HTTP transport.
Auth: `withMcpAuth` — bearer token = Meta access token, verified by Meta API itself.
Refs: global namespace in `entity_refs` Postgres table. `lib/mcp/refs.ts` for CRUD.
Tools: `lib/mcp/tools.ts` — each tool calls `getClient(extra)` which reads `extra.authInfo.token`.

**Claude Code client config** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "xma-meta": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<deployment>.vercel.app/api/mcp",
        "--header", "Authorization: Bearer ${META_TOKEN}"
      ],
      "env": { "META_TOKEN": "EAAB..." }
    }
  }
}
```

## Cross-Business Ad Account Setup

When managing campaigns on an ad account owned by another business:

1. **Ad account access** — the other business must share the ad account via Business Settings → Ad Accounts → Assign Partners (grant your Business ID manage campaigns permission)
2. **Page access** — the Facebook Page must ALSO be shared separately via Business Settings → Pages → Assign Partners (grant Create Content permission). Sharing only the ad account is not enough — ad creative creation requires page-level permission.
3. **Instagram linking** — the Instagram account must be linked to the Facebook Page (Page Settings → Linked Accounts → Instagram) before using `instagramActorId` in ad creatives. Verify with the Page's `/instagram_accounts` endpoint before adding to config. The `get_instagram_accounts` MCP tool checks the ad account level, which is different from the page-level link required for ad creatives.
4. **Verify before pipeline run** — always confirm page access (`GET /{page_id}?fields=name,access_token`) and Instagram linking before running the pipeline to avoid partial failures that create orphaned campaigns/ad sets.
