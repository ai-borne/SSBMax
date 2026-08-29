# Known Tech Debt — Quota Enforcement Gap + Fake Content Caching

Surfaced during the ai_search_readiness/GEO Phase 8 work (2026-08-29) while discussing whether
the project incurs avoidable cloud costs. Neither issue was caused by or touched during that
phase — both are pre-existing, documented elsewhere, and just re-surfaced here as a single
punch list for a dedicated sprint. Not urgent (traffic is still low), but should be resolved
before real user launch.

---

## Step 0 — Pull actual Gemini spend from GCP billing before scoping either fix

Everything below is architectural risk, not a measured dollar figure — no Gemini API spend
number has actually been pulled for this project. Before deciding how urgently to act on Issue 1
in particular, get the real number:

- GCP Console → Billing → the `ssbmax-49e68` project's billing account → Reports, filtered to
  the Generative Language API (Gemini) SKU, or `gcloud billing accounts list` /
  `gcloud beta billing accounts describe` if scripting it.
- Break it down by day/week over the last ~2-4 weeks to see the trend, not just a total — the
  bake-criteria counts in Issue 1 below show usage is still low today, so the real question is
  the *slope*, not the current total.
- If Cloud Monitoring / Logging has per-function invocation counts for `geminiProxy` vs. the
  `evaluate*` dispatchers, pull those too — it separates "how much are we spending" from "how
  much of that spending is going through the unmetered legacy path specifically."

This number is what should actually drive urgency and the (a)/(b) decision in Issue 1 — a
project spending $5/month on Gemini calls doesn't need the same urgency as one spending $500/month
with no server-side cap.

---

## Issue 1 — Quota enforcement gap on 7 test types (the bigger one)

**What:** WAT, SRT, SD, TAT, PPDT, GTO, and Interview are marked "Shipped" but not "Cutover" to
the centralized server-side evaluation dispatcher (`functions/src/evaluation/core.js`). Only OIR
has genuinely cut over. See `docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md` for the full
architecture and tracker — this section just summarizes the live state as of 2026-08-29.

**Why it costs money:** the 7 non-cutover types still run through KMP's legacy client-side
orchestrators (`shared/.../analysis/*Orchestrator.kt`) calling `functions/src/geminiProxy.js`, a
raw passthrough that accepts whatever prompt the client sends. It's protected only by a coarse
**per-user hourly** abuse cap — not a server-side re-check against the user's actual monthly
subscription quota, which is what `core.js::runEvaluation` does for the cutover path. A bug in
the client-side quota pre-check, or a direct API call bypassing the app entirely, can spend
Gemini API calls beyond what a user's tier should allow.

**Confirmed live (2026-08-29), not just read from the tracker doc:**
- `feature_flags/config` in prod: all 7 `{type}_server_evaluation` flags are `true` — but this
  was a one-shot manual dev-testing flip on 2026-08-16 via `functions/scripts/set-feature-flags.js`
  ("for manual testing"), not a real Cutover decision.
- Bake criteria is ≥100 successful evaluations per type, <2% error rate, 3-day floor. Actual prod
  counts: `psych_results` (shared by WAT+SRT+SD+TAT combined) = **40 total docs**, `gto_results`
  = **16**, `ppdt_results` = **34**, `interview_results` = **24**. No type is anywhere close to
  100 — several types share `psych_results`, so the per-type number is even lower than 40.
- `functions/.env.ssbmax-49e68` (tracked in git) still has `ENFORCE_QUOTA=false` — quota
  enforcement is **globally disabled** in prod right now, deliberately, for dev testing. This
  compounds the gap: even the cutover path's quota check is currently a no-op logging
  `[ENFORCE_QUOTA=false] Would have blocked ...` instead of actually blocking.

**Not yet an emergency** because usage is still low (dozens of evaluations, not hundreds), but
exposure grows linearly with traffic and nothing currently caps it beyond the hourly rate limit.

**The decision that's actually blocking this** (from the tracker's §3, still open): either —
- (a) accept all 7 flags as permanently `true`, skip formal bake tracking, and flip
  `ENFORCE_QUOTA=true` now, or
- (b) revert the flags to `false` and let each type re-earn Cutover for real against the
  ≥100-eval/<2%-error/3-day-floor bar.

Whoever picks (a) or (b) should update `docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md` §2/§3
with the decision and date — it's the one source of truth for this, and it's already drifted out
of sync once (recreated from a lost original plan).

---

## Issue 2 — Content caching is claimed in the UI but doesn't exist

**What:** `ContentFeatureFlags.enableOfflinePersistence` and `cacheExpiryDays` are read by
nothing in the codebase — dead config. `StudyMaterialContentProvider.kt:70` (or nearby, verify
current line) tells users content is "cached for 7 days" — this is **false**. There is no
SQLDelight table for `topic_content` or `study_materials`, and Firestore's offline persistence
was never ported to KMP (`GitLiveStudyContentRepository.kt` documents this as a known gap in its
own comments).

**Why it costs money:** every time a user reopens a Study/Topic screen, the app almost certainly
re-fetches from Firestore live instead of serving from a 7-day cache that was never wired up.
Small per-read cost, multiplied across every mobile session — a real but modest avoidable-read
cost, plus (arguably worse) a **user-facing lie** about offline capability that would surface
badly the first time someone tries this app with no signal.

Root CLAUDE.md's HIGH 4b (from the ai_search_readiness plan) already flagged this exact gap
during Phase 1 of that plan and deliberately deferred it as out of scope there — this doc is
where it should actually get picked up.

---

## Prompt for a new Claude Code session to address this sprint

Paste the block below verbatim into a fresh session when starting the next sprint:

```
Read /Users/sunil/Downloads/SSBMax-kmp/docs/plans/known_cost_and_caching_debt.md in full, then
address both issues it documents as a single sprint:

0. First, pull actual Gemini API spend from GCP billing for the ssbmax-49e68 project (see
   "Step 0" in the doc) — daily/weekly trend over the last 2-4 weeks, not just a total, and
   per-function invocation counts for geminiProxy vs. the evaluate* dispatchers if available.
   Report this to the user before proposing how urgently to act on issue 1 below — the doc's
   framing (bake-criteria counts, ENFORCE_QUOTA state) is about mechanism and risk, not measured
   dollars, and the real spend number should drive how the (a)/(b) decision gets prioritized.

1. Quota enforcement gap on 7 test types (WAT/SRT/SD/TAT/PPDT/GTO/Interview). Before touching
   code: re-verify the live state described in the doc still holds (feature_flags/config values,
   ENFORCE_QUOTA in functions/.env.ssbmax-49e68, and current {type}_results/psych_results/
   submissions counts against the ≥100-eval bake bar) — don't assume the numbers from this doc's
   write-up are still current. Then get an explicit decision from the user on option (a) vs (b)
   in the doc (accept flags as permanent + enforce quota now, vs. revert and re-earn Cutover per
   type) before making the change — this is not a call to make unilaterally, it changes what
   happens to real user billing/quota enforcement. Once decided, implement it and update
   docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md §2/§3 with the decision, date, and any
   Cutover-checklist items from its §4 that now apply.

2. Fake content caching. ContentFeatureFlags.enableOfflinePersistence/cacheExpiryDays are dead
   config, and the UI's "cached for 7 days" claim is false (no SQLDelight table, no Firestore
   offline persistence on KMP). Either implement real caching (SQLDelight-backed, respecting
   cacheExpiryDays) or remove the flags and correct the UI copy to not claim a capability that
   doesn't exist. Check whether shared/.../GitLiveStudyContentRepository.kt's doc comments (or
   nearby) still describe this as a known gap before deciding scope — surface the two options to
   the user rather than picking silently, since this affects both Android and iOS UI copy and
   possibly adds a new persistence layer.

Follow root CLAUDE.md's Rule 1 (state assumptions, ask rather than guess) and Rule 12 (fail loud)
throughout — both issues involve a real user-facing or billing-facing decision, not just a code
fix. Do not fix either without confirming current state first; both numbers and flags may have
moved since this doc was written (2026-08-29).
```
