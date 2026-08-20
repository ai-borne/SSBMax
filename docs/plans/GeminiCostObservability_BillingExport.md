# Gemini/Cloud Cost Observability — Actions Taken (2026-08-19)

**Trigger:** ₹114 GCP cost on 2026-08-16 while manually testing ~4-5 attempts of each SSB
test type, with no way to see which test type actually drove it. This doc is the record of
what was set up in response, and the prompt to use once there's enough data to act on.

## Context established during investigation

- **No cost/usage data existed anywhere before this** — not in Firestore, not in BigQuery.
  The only view was the aggregate GCP Billing console UI, which isn't queryable and gives no
  per-test-type breakdown.
- **Gemini call count per test is wildly uneven** — this, not a flat per-test cost, is the
  likely reason a handful of manual test runs added up:
  | Test type(s) | Gemini calls per single test |
  |---|---|
  | WAT, SRT, SD, PPDT, GTO (GD/GPE/Lecturette/PGT/HGT) | 1 |
  | **TAT** | **13** (12 per-story + 1 synthesis — `functions/src/evaluation/tatEvaluate.js`) |
  | **Interview** | **~25-26** (1 call per question response, `TARGET_TOTAL_QUESTIONS = 25` in `functions/src/interview/createInterviewSession.js`, plus AI question-generation calls in `generateQuestions.js`) |
  | Any of the above on a retry | +1 call per retry attempt, up to 3 (`functions/src/evaluation/retry.js`) |
- PPDT/TAT images are fetched server-side from `firebasestorage.googleapis.com` /
  `storage.googleapis.com` (`ALLOWED_IMAGE_HOSTS` in `tatEvaluate.js`) — a separate Cloud
  Storage cost (storage + egress) from the Gemini spend, not yet broken out either.

## Actions taken

1. **BigQuery billing export enabled** — Standard usage cost export, project `ssbmax-49e68`,
   dataset `billing_export`, location `asia-south1`. **Effective from 2026-08-19 onward —
   does NOT backfill 2026-08-16.** First rows may take 24-48h to land after enabling.
   - Table will appear as `ssbmax-49e68.billing_export.gcp_billing_export_v1_<billing_account_id>`
     (billing account `01806C-330CA6-8F25DD` → table name with underscores in place of dashes,
     e.g. `gcp_billing_export_v1_01806C_330CA6_8F25DD` — confirm exact name once it appears,
     `bq ls billing_export` will show it).

2. **Per-call Gemini token/cost logging added** (`functions/src/evaluation/geminiClient.js`):
   every `generateContent()` call now logs a structured Cloud Logging entry
   `jsonPayload.event = "gemini_usage"` with `testType`, `submissionId`, `callTag` (e.g.
   `story_3`, `synthesis`, or an interview `responseId`), `promptTokenCount`,
   `candidatesTokenCount`, `totalTokenCount`, and an `estimatedCostInr` field.
   - Threaded through all 7 call sites: `core.js` (WAT/SRT/SD), `ppdtEvaluate.js`,
     `tatEvaluate.js` (both per-story and synthesis calls), `gtoEvaluate.js`,
     `interviewEvaluate.js`, `generateQuestions.js` (AI question-gen).
   - **`estimatedCostInr` uses placeholder rate-card constants** (`USD_PER_1M_INPUT_TOKENS`,
     `USD_PER_1M_OUTPUT_TOKENS`, `INR_PER_USD` at the top of `geminiClient.js`) — verify
     against https://ai.google.dev/gemini-api/docs/pricing and the actual INR conversion
     rate before trusting these numbers; they're a rough dashboard estimate, not
     billing-accurate (doesn't account for cached-input discount or image-token surcharge).
   - Deployed to prod (`firebase deploy --only functions --project ssbmax-49e68`), verified
     306/306 existing tests pass with the added `meta` param on every `generateContent` call
     site (fakes injected in tests ignore the extra arg harmlessly).

3. **`firebase-functions` upgraded** `^7.0.0` → `^7.3.2` (was flagged outdated on deploy).
   Re-deployed after upgrade; tests re-verified green.

4. **`functions.config()` deprecation notice** — checked: **not used anywhere in this
   codebase** (`grep -rn "functions.config(" functions/src/` returns nothing; secrets/config
   already go through `.env.ssbmax-49e68` + Secret Manager, per `functions/CLAUDE.md`). The
   warning is generic to the `firebase-functions` package and needs no migration here. No
   action taken beyond confirming this.

## What's NOT done yet

- No historical Aug 16 breakdown — the export doesn't backfill. That day's cost can only be
  reconstructed manually via Billing console → Reports → filter project + date + group by SKU
  (not queryable by me without the export).
- `estimatedCostInr` rate-card constants are unverified placeholders (see above).
- Cloud Storage egress cost for `test_content` images (PPDT/TAT/GTO_GPE) is not yet broken
  out or logged anywhere — only knowable once the billing export has data.
- No log-based metric / Cloud Monitoring dashboard built yet on top of the `gemini_usage`
  logs — recommended next step once there's a few days of real data, so cost-per-test-type is
  visible without manually running Logs Explorer queries each time.

## Prompt to use after ~48 hours (once billing export data has landed)

Paste this into Claude Code in this repo:

> The BigQuery billing export (`ssbmax-49e68.billing_export`, enabled 2026-08-19) and the
> `gemini_usage` structured Cloud Logging entries (added in `functions/src/evaluation/geminiClient.js`,
> deployed same day) should both have a few days of real data now. Read
> `docs/plans/GeminiCostObservability_BillingExport.md` for full context, then:
> 1. Query the billing export table for cost grouped by `service.description` and
>    `sku.description` over the last few days — confirm the actual split between Generative
>    Language API (Gemini) and Cloud Storage (image egress for PPDT/TAT/GTO_GPE).
> 2. Query/read the `gemini_usage` Cloud Logging entries (Logs Explorer filter
>    `jsonPayload.event="gemini_usage"`) grouped by `testType`, sum `totalTokenCount` and
>    `estimatedCostInr` — compare actual per-test-type average cost against the call-count
>    table in this doc's Context section to confirm or correct the TAT/Interview-dominate
>    hypothesis.
> 3. Verify the `USD_PER_1M_INPUT_TOKENS`/`USD_PER_1M_OUTPUT_TOKENS`/`INR_PER_USD` constants
>    in `geminiClient.js` against current Gemini pricing and correct if stale.
> 4. Report actual ₹-per-test-type cost, and flag whether Cloud Storage egress is large
>    enough to revisit the Cloudflare R2 question for `test_content` images.
> 5. If the numbers are stable and useful, propose (don't build unless asked) a log-based
>    metric + Cloud Monitoring chart so this is visible ongoing without a manual query.

## Reference

- Files touched: `functions/src/evaluation/geminiClient.js`, `core.js`, `ppdtEvaluate.js`,
  `tatEvaluate.js`, `gtoEvaluate.js`, `interviewEvaluate.js`,
  `functions/src/interview/generateQuestions.js`, `functions/package.json`.
- Related: `docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md` (the Tier-2 evaluation
  architecture this logging was added to), `functions/CLAUDE.md` (evaluation SSOT pattern).
