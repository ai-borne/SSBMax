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

---

# Known Cost & Caching Debt — Sprint Plan

## Context

`docs/plans/known_cost_and_caching_debt.md` (2026-08-29) documented two pre-existing tech-debt
items surfaced while discussing avoidable cloud cost: a quota-enforcement gap on 7 test types, and
a fake "content is cached" claim in the study-materials UI. Both were re-verified live in this
session (via Explore agents) before planning, per the doc's own instruction not to trust the
write-up's numbers as still current.

**Issue 1 verification result:** the doc's picture holds — `ENFORCE_QUOTA=false` in
`functions/.env.ssbmax-49e68`, all 7 `{type}_server_evaluation` flags manually flipped `true` on
2026-08-16 for dev testing (not a real Cutover), no type near the ≥100-eval bake bar, legacy
orchestrators and `geminiProxy.js` still live and referenced. **User decision:** get real GCP
billing numbers before choosing (a) accept-as-permanent vs (b) revert-and-re-earn — and the user
has *intentionally* re-confirmed `ENFORCE_QUOTA=false` for ongoing dev testing, so this sprint
must not flip it.

**Issue 2 verification result:** the specific false "cached for 7 days" UI string is already gone
— `StudyMaterialContentProvider.kt` now correctly tells users content isn't stored offline yet.
Only `ContentFeatureFlags.enableOfflinePersistence`/`cacheExpiryDays` remain as dead, unread
config (confirmed: only self-referenced inside an uncalled `getStatus()` debug method). **User
decision:** remove the dead flags, and — per the senior-dev recommendation given inline — also
implement the real SQLDelight-backed cache, since the existing `Cached*`/`*BatchMetadata` +
`GitLive*CacheManager` pattern (already used for OIR/GTO/WAT/GPE/PPDT/SRT/TAT) makes this low-risk
to extend, and it directly reduces recurring Firestore read cost as traffic grows.

---

## Part A — Issue 1: Quota enforcement gap (data-gathering only this sprint)

No code changes to flags, `ENFORCE_QUOTA`, or the orchestrators this sprint — the (a)/(b) call is
explicitly deferred pending real spend data, and the user has deliberately kept
`ENFORCE_QUOTA=false` for dev testing.

1. **Pull actual Gemini spend** for the `ssbmax-49e68` project:
   - GCP Console → Billing → Reports filtered to the Generative Language API SKU, or
     `gcloud billing accounts list` / `gcloud beta billing accounts describe` if scripting it.
   - Break down by day/week over the last 2–4 weeks (trend, not just a total).
   - If available, pull Cloud Monitoring/Logging invocation counts for `geminiProxy` vs. the
     `evaluate*` dispatchers, to separate total spend from "how much is going through the
     unmetered legacy path."
2. **Report the numbers to the user** before any (a)/(b) recommendation is made.
3. **Update `docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md` §2/§3** to record, dated today:
   - `ENFORCE_QUOTA=false` is a confirmed-intentional dev-testing state as of this sprint (not an
     oversight) — re-affirmed by the user, so it should not be auto-flipped by a future session
     without an explicit request.
   - The (a)/(b) Cutover decision remains open, now explicitly blocked on the billing numbers from
     step 1, not just "needs a decision."

---

## Part B — Issue 2: Content caching

### B1. Remove dead flags (cleanup)
- Delete `enableOfflinePersistence` and `cacheExpiryDays` from
  `shared/src/commonMain/kotlin/com/ssbmax/shared/domain/config/ContentFeatureFlags.kt`, and the
  `getStatus()` debug method that was their only reader (confirmed zero external callers).
- If `ContentFeatureFlags` becomes empty/pointless after this, remove the class entirely; if other
  live flags remain in it, leave those untouched.

### B2. Implement real SQLDelight-backed caching for study/topic content
Follow the existing convention exactly — this is "apply the established pattern," not "design a
new caching layer."

- **Schema:** add cache tables to
  `shared/src/commonMain/sqldelight/com/ssbmax/shared/db/SharedDatabase.sq`, mirroring the
  `CachedOIRQuestion`/`OIRBatchMetadata` (or similar) pairing already used for the seven other
  content types — one pairing each for topic content and study-material content (or a shared
  table keyed by content type, if that better fits the existing `DocumentModel` shape from
  `scripts/content/parseDocument.js` output — check how `content/topics/` vs.
  `content/study-materials/` are currently modeled before deciding one table vs. two).
- **Cache manager:** add a `GitLiveStudyContentCacheManager.kt` under
  `data-firebase/src/commonMain/kotlin/com/ssbmax/shared/data/repository/`, following the shape of
  `GitLiveOIRQuestionCacheManager.kt` (or `GitLiveGTOTaskCacheManager.kt`) — read-through cache,
  TTL-based expiry (7 days, as a `private const val`, not new config since B1 removes the flag),
  stale-while-revalidate rather than a network-blocking read when a valid cached copy exists.
- **Repository wiring:** update `GitLiveStudyContentRepository.kt` to consult the cache manager
  first, fall back to the existing Firestore read path on cache miss/expiry, and write through on
  fetch. Update its class doc comment (currently documents the offline-persistence gap verbatim)
  to reflect that this slice is now resolved, without re-litigating the GitLive
  `PersistentCacheSettings` limitation it correctly explains (that's about Firestore's own SDK
  cache, not this app-level SQLDelight cache — no need to imply that's changed).
  - Add a matching `GitLiveStudyContentCacheManagerTest.kt` under
    `data-firebase/src/androidUnitTest/...`, following the pattern of the other `*CacheManagerTest.kt`
    files (cache hit, cache miss/expiry, write-through).
- **UI copy:** once the cache is real, update `StudyMaterialContentProvider.kt`'s
  `getContentUnavailable()` messaging (and any other place claiming/denying offline capability) to
  accurately describe the new behavior — don't restore the old "cached for 7 days" wording
  verbatim without checking it still matches the actual TTL and offline-availability semantics
  (e.g., is it "available offline after first load" or "cached for faster reloads but still
  requires a first online fetch" — the implementation determines which claim is true).
- **SSOT check:** per root `CLAUDE.md`, `shared`/`data-firebase` serve both Android and iOS from
  one implementation — confirm nothing here forks by platform (it shouldn't, since SQLDelight and
  the cache manager are both commonMain/data-firebase already).

---

## Verification

- `./gradlew testDebugUnitTest` (or the `data-firebase`/`shared`-scoped equivalents) for the new
  cache manager tests plus existing suites — must stay green.
- `./gradlew check` for lint (no hardcoded strings introduced by new UI copy — must go through
  Compose Resources per Mandatory Lint Rule 2).
- Manual check: open a Study/Topic screen, background/kill and reopen the app with network
  disabled, confirm cached content renders instead of a load failure; confirm a cache-miss (first
  ever load, or past TTL) still fetches live successfully.
- Confirm `docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md` §2/§3 reads correctly after the
  Part A doc update — no stale claim that a decision was made when it wasn't.
