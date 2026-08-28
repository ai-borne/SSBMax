# Phase 0 Findings — AI Search / GEO Readiness

Date: 2026-08-28. Source: live production Firestore (`ssbmax-49e68`, read-only export via ADC), repo audit. No production code changed.

## 1. Content volume (BLOCKER 1's decisive input)

| Collection | Docs | Avg words/doc | Total words |
|---|---|---|---|
| `topic_content` | 10 | 118.6 | 1,186 |
| `study_materials` | 52 | 994.0 | 51,688 |

**Premise correction:** the plan's pessimistic Blocker-1 hypothesis ("if Firestore study content is thin, a few hundred words/day, Phase 7 net-new writing becomes the primary value driver") is **wrong for `study_materials`**, right for `topic_content`. `study_materials` is genuinely long-form (up to 2,240 words/doc for `int_6`, `psy_5`, `psy_7`) and is the real citable payload. **Phase 1's materialization must target `study_materials.contentMarkdown` as the primary content source**, not `topic_content.introduction` (which is closer to a short per-topic teaser). Un-gating is still the primary value driver — the plan's original weighting holds, for the right reason.

## 2. NEW finding — 31% of study_materials is placeholder stub content

16 of 52 `study_materials` docs (every doc in 4 whole categories) contain **only**: `"Content for this material is being prepared. Please check back soon!"` (68 chars).

- All 4 `CONFERENCE` materials (`conf_1..4`)
- All 5 `MEDICALS` materials (`med_1..5`)
- All 3 `PIQ_FORM` materials (`piq_1..3`)
- All 4 of 4 `SSB_OVERVIEW` materials (`ssb_1..4`)

Only `GTO`, `INTERVIEW`, `OIR`, `PPDT`, `PSYCHOLOGY` have real prose throughout.

**Impact:** un-gating (Phase 4) or sitemap-including (Phase 3) these routes as-is would publish visibly broken "coming soon" placeholder pages to anonymous visitors *and* AI crawlers on exactly the categories most likely to be cited — actively harmful for GEO, not neutral. **New pre-requisite for CONFERENCE/MEDICALS/PIQ_FORM/SSB_OVERVIEW: write real content before those specific routes are un-gated/indexed**, or exclude them from the public route set / sitemap until written. This is new scope, not covered by the original plan.

## 3. Formatting — plan's assumed split does not exist

Both `topic_content.introduction` (checked `CONFERENCE`, `OIR`) and `study_materials.contentMarkdown` already use consistent Markdown (`**bold**`, `-` bullets, `#`/`##` headers). The plan's Phase 0 task ("note the CONFERENCE-vs-rest formatting split — markdown vs plain text with `-` bullets") does not reproduce against current production data — no normalization pass is needed for this. (Low confidence this was ever true and was fixed since, or was never true; not investigated further as it's now moot.)

## 3b. `SSBContentProvider.getInfoCards()` — a third, stale overlapping prose source

`shared/.../domain/util/SSBContentProvider.kt` carries its own hardcoded "What is SSB / 5-Day Selection Process" prose, used by the SSB Overview screen. Its own doc comment says it's "static/educational mock content... this will be replaced with real repository data in production, same TODO the Android original carries" — that TODO was never done. This is a **third** copy of the same "5-day SSB process" facts (alongside web's `ssbDayData.ts` scaffolding and KMP's `TopicContentLoader`/`SSB_OVERVIEW` `study_materials` docs), and the `SSB_OVERVIEW` `study_materials` docs it should have been replaced by are themselves the 4 placeholder stubs from §2. Not in this plan's original scope — flagging as pre-existing debt per `CLAUDE.md`'s "don't silently patch and move on" rule, to fix opportunistically when `SSB_OVERVIEW` content is written (§2/Escalation item 1), not as new Phase-0 work.

## 4. `web/public/_redirects` — does not exist

There is no `_redirects` file and no `functions/` (Pages Functions) directory in `web/`. Confirmed via `wrangler.toml` (`pages_build_output_dir = "dist"`, no redirect/routing config) and `web/dist` build output. **HIGH 6's shadowing risk is currently moot**: nothing intercepts arbitrary paths today because the app has no path-based routes yet (`?tab=` only) — there is no SPA catch-all to collide with. Once Phase 2 adds `react-router-dom` for new content paths, this remains fine for the *new* static routes (they're real files under `dist/<route>/index.html`), but if the SPA itself ever needs client-side deep-link fallback behavior later, that will require adding a `_redirects` line then — not a blocker now, just noted for later phases.

## 5. `firestore.rules` — confirmed as documented

`topic_content` (`:419-423`) and `study_materials` (`:446-450`) both `allow read: if isAuthenticated(); allow write: if false;` — matches Blocker 3's note. Build-time materialization must use `firebase-admin`/ADC (bypasses rules), never a client-side fetch for public pages.

## 6. `authService.signInWithGoogle()` — confirmed popup mode

`web/src/services/AuthService.ts:28-33` uses `signInWithPopup(this.auth, new GoogleAuthProvider())`, not `signInWithRedirect`. Supports HIGH 3's fix: moving nothing under `/app/*` was already the right call, and this confirms there's no redirect-URI path dependency to worry about either way.

## 7. Baseline measurement — cannot be captured retroactively

Checked `web/index.html`, `web/src`, `web/public` for any analytics/verification: **zero instrumentation exists** — no `gtag`/GA, no Plausible, no PostHog, no Firebase Analytics (`getAnalytics`), no Google Search Console verification meta tag or file, no `_headers`-level analytics beacon.

**Premise correction for MEDIUM 10:** there is no historical baseline to pull — GSC was never verified, so "capture indexed page count" returns nothing today, and there's no existing signup-rate-through-study-gate metric to diff against. Phase 0 cannot produce a retroactive baseline because none was ever recorded. Reframe: **Phase 3/8 must wire up GSC verification + minimal privacy-respecting analytics (referrer segmentation, signup events) first**, and "day zero" becomes whenever that instrumentation ships — not something recoverable from the past. This should be called out explicitly to stakeholders so "before/after" comparisons are understood to start from Phase 3/8, not from today.

## 8. AI visibility diagnostic — needs manual run (not automatable from here)

Querying ChatGPT/Perplexity/Claude's hosted chat UIs requires logged-in interactive sessions this environment doesn't have login access to; not reliably automatable via headless fetch (these are conversational products, not stable API-key endpoints for this purpose). **Action item for the user**: paste each of the following into ChatGPT, Perplexity, and Claude, and record whether SSBMax appears in the answer:

1. "Best app for SSB interview preparation"
2. "How to prepare for TAT WAT SRT psychology tests SSB"
3. "SSB interview coaching app India"
4. "What is OIR test in SSB selection"
5. "Group Testing Officer tasks GTO preparation app"
6. "How to prepare for SSB conference Day 5"
7. "PPDT test practice app"
8. "Officer Like Qualities OLQ preparation"
9. "Free SSB psychology test practice online"
10. "AI evaluation for SSB interview answers"

Record: appears / doesn't appear, and if it appears, the exact recommendation context. This becomes the Phase 8 re-run comparison baseline.

---

## Escalation — premises requiring a decision before Phase 1

1. **New scope**: 4 content categories (CONFERENCE, MEDICALS, PIQ_FORM, SSB_OVERVIEW) are 100% placeholder stubs in `study_materials`. Un-gating/indexing them as-is ships "coming soon" pages publicly. Recommend: **write real content for these 4 categories as a Phase-1/7 prerequisite for those specific routes**, or explicitly exclude them from the public route set and sitemap until written, shipping only the 5 categories that have real content (GTO, INTERVIEW, OIR, PPDT, PSYCHOLOGY) in the first pass.
2. **Materialization target**: confirm Phase 1's build-time content pull should read `study_materials.contentMarkdown` (52 docs, real prose) as primary, with `topic_content.introduction` (10 docs, short) used only as the per-topic landing-page intro/summary, not the main body.
3. **Baseline reframing**: confirmed OK to treat Phase 3/Phase 8 GSC+analytics wiring as the actual "day zero," since no historical data exists to recover.
