# Meta Ads Management Standard Access — App Review Submission Guide

## Status: PENDING SUBMISSION

**Blocker:** Ad creative creation fails with error subcode 1885183 ("app in development mode").
**What works:** Campaign creation, ad set creation, video uploads, creative caching.
**What's blocked:** Ad creative creation — requires "Ads Management Standard Access" feature approval.

---

## Prerequisites

### 1. Business Verification

- Go to **Business Settings → Security Center**
- If not verified, click **Start Verification** and submit:
  - Legal business name (exact match to registration)
  - Business address
  - Business phone number
  - 2 supporting documents (business license, tax registration, bank statement, or utility bill)
- Approval: minutes to a few days

### 2. App Settings Must Be Complete

Go to **App Dashboard → App Settings → Basic** and ensure:

- App icon (1024×1024, no Meta logos)
- Privacy policy URL: https://www.xma.ae/privacy-policy
- Contact email
- App purpose: select **"Yourself or your own business"** (or "Clients" if managing for others)
- Category: select "Business and Pages"

---

## Submission Steps

### 3. Add Features to App Review

Go to **Use Cases → Create & manage ads → Permissions and features**

Add each of these:

| Item | Action |
|------|--------|
| Ads Management Standard Access | Actions → Add to app review |
| ads_management | Actions → Add to app review |
| ads_read | Actions → Add to app review (if not already) |

### 4. Write Usage Descriptions

Each permission/feature needs a **unique** description. Do not copy-paste between them.

**Ads Management Standard Access:**

> Our internal agency tool creates Meta ad campaigns programmatically for our clients. We use the Marketing API to upload video/image creatives, create ad creatives with multiple copy variations, build campaigns with targeted ad sets, and manage ad status. This tool is used by our agency team to efficiently launch campaigns at scale.

**ads_management:**

> We use ads_management to create campaigns, ad sets, ad creatives, and ads via the Marketing API. Our tool reads a YAML configuration file defining campaign structure, uploads creative assets, and creates the full campaign hierarchy on Meta. All campaigns are created in PAUSED status for review before activation.

**ads_read:**

> We use ads_read to retrieve campaign performance data, verify created entities, and pull insights for reporting to our clients.

### 5. Record Screencast

Record a screen recording (no audio needed, add captions/annotations) showing:

1. **Your tool's config file** — show the YAML config with campaign structure
2. **Running the pipeline** — show `bun scripts/meta/run-pipeline.ts` executing
3. **Campaign + ad set created successfully** (these work now)
4. **The ad creative error** — demonstrate this is the step that needs the permission
5. **The result** — the `_result.yaml` file with created entities
6. **Meta Ads Manager** — the created campaign/ad set visible in the UI

**Recording tips:**

- 1080p minimum, 1440px width or less
- English UI
- Use OBS or similar to record
- Annotations to highlight key moments
- 2–5 minutes long

### 6. Submit

- Accept Platform Onboarding Terms
- Click Submit
- Expected decision: ~1 week (often faster for Standard Access)

---

## Workaround While Waiting

Use **Pipeboard Meta Ads MCP** as an immediate workaround:
- Remote MCP server: `https://mcp.pipeboard.co/meta-ads-mcp`
- Their Meta app already has Advanced Access approved
- Can create ad creatives through their service now

---

## After Approval

1. **Regenerate the System User token** — Business Settings → System Users → Generate Token (new token inherits the approved feature)
2. Update `.env.local` with the new `META_APP_TOKEN`
3. Run the pipeline:
   ```bash
   bun scripts/meta/run-pipeline.ts campaigns/floarea-mothers-day/config.yaml
   ```

---

## Future: Advanced Access

Standard Access limits you to ad accounts your business owns or has been granted access to. For cross-business client ad accounts, you may eventually need **Advanced Access**, which requires:

- 1500+ API calls in the last 15 days
- Error rate under 15%
- Separate App Review submission

---

## Sources

- [Meta Authorization Docs](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)
- [Ads Management Standard Access Feature Reference](https://developers.facebook.com/docs/features-reference/ads-management-standard-access/)
- [App Review Submission Guide](https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide)
- [Screen Recording Guide](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/)
