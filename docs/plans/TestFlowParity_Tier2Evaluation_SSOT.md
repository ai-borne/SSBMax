# Web SSB Test Flow Parity + Centralized Tier-2 Evaluation SSOT — Status & Cutover Tracker

**Status:** Referenced by root `CLAUDE.md` and `functions/CLAUDE.md` as "complete through
Phase 12," but no plan document existed anywhere in `docs/plans/` — this file recreates
it as a living status/tracker, reconstructed from `functions/src/`, `firestore.rules`, and
a direct prod Firestore read on 2026-08-16, not from an original phase-by-phase plan (that
history is lost). Going forward, this is the one place to check/update per-type Cutover
status — do not let it drift out of sync with reality again.
**Created:** 2026-08-16 (reconstruction)
**Owner:** sunilpawar
**Scope:** Tracking which SSB test types have genuinely finished migrating from
KMP's legacy client-side Gemini evaluation to the centralized server-side
`functions/src/evaluation/` dispatcher (`core.js::runEvaluation`), and what's still
gated behind a feature flag vs. hard-cut-over.

---

## 1. The Architecture (for context — see `functions/CLAUDE.md` for full detail)

- `functions/src/evaluation/core.js` is the one dispatcher: auth, ownership, status guard,
  server-side quota check + charge, retry-wrapped Gemini call, result write. Every
  `evaluate*.js` callable (`ppdtEvaluate`, `tatEvaluate`, `watEvaluate`, `srtEvaluate`,
  `sdEvaluate`) is a thin wrapper over it. `gtoEvaluate.js` and `interviewEvaluate.js` are
  bespoke wrappers (different submission shapes) that reuse the same primitives directly.
- KMP's legacy client-side path (`shared/.../analysis/*Orchestrator.kt`,
  `shared/.../ai/prompts/*.kt`, `functions/src/geminiProxy.js`) still exists and is **not**
  migration debt — it's the intentional fallback for any type not yet Cut Over.
- Each non-OIR type is gated behind a Firestore-backed feature flag
  (`{type}_server_evaluation` in `feature_flags/config`), read via
  `FeatureFlagRepository` on both KMP and web. **Web has no flag check at all** — it always
  calls the server path unconditionally (`web/src/services/testEvaluationOrchestrator.ts`).
  KMP is the only platform whose behavior actually depends on the flag.
- **Cutover criteria** (per root `CLAUDE.md`): ≥100 successful evaluations at <2% error
  rate, with a 3-day floor, before a type's flag is considered permanently `true` and its
  legacy KMP code becomes deletable.

---

## 2. Per-Type Status (as of 2026-08-16)

| Type | Flag key | Prod flag value (checked 2026-08-16) | Legacy KMP path exists? | Genuinely Cut Over? |
|---|---|---|---|---|
| OIR | *(none — no flag, hard-cut-over from the start)* | N/A | No (fully removed) | **Yes** — the only type with no legacy fallback at all |
| WAT | `wat_server_evaluation` | `true` | Yes (`PsychAnalysisOrchestrators.kt`) | **No** — flag is `true` today only because it was manually flipped for dev testing (see §3), not because bake criteria were met |
| SRT | `srt_server_evaluation` | `true` | Yes (`PsychAnalysisOrchestrators.kt`) | **No** — same caveat |
| SD | `sd_server_evaluation` | `true` | Yes (`PsychAnalysisOrchestrators.kt`) | **No** — same caveat |
| PPDT | `ppdt_server_evaluation` | `true` | Yes (`PPDTAnalysisOrchestrator.kt`) | **No** — same caveat |
| TAT | `tat_server_evaluation` | `true` | Yes (`TATAnalysisOrchestrator.kt`) | **No** — same caveat |
| GTO | `gto_server_evaluation` | `true` | Yes (`GTOAnalysisOrchestrator.kt`) | **No** — same caveat |
| Interview | `interview_server_evaluation` | `true` | Yes (`InterviewAnalysisOrchestrator.kt`) | **No** — same caveat |

**Why "flag is true" ≠ "Cut Over" today:** the prod `feature_flags/config` doc was created
2026-08-16 (its `createTime` equals its `updateTime` — first-ever write) with all 7 flags
set `true` in one shot, via `functions/scripts/set-feature-flags.js`, a script explicitly
labeled "for manual testing." This was confirmed as a deliberate dev-mode action (not an
accidental prod flip) to unblock testing without hitting client-tracked test-count limits.
**No type has actually accumulated ≥100 successful evaluations / 3-day bake data behind
this flag state** — it's a manual override, not a completed migration.

---

## 3. Action Items Before Real Launch

1. **Decide the flag's fate before production traffic.** Either:
   - (a) leave all 7 flags `true` permanently and treat this as the real Cutover decision
     (skip formal bake tracking, accept the risk), or
   - (b) revert to `false` post-dev-testing and let each type re-earn Cutover against the
     ≥100-eval/<2%-error/3-day-floor criteria for real.
   Whoever flips this should update the table in §2 with the actual decision and date.
2. **`ENFORCE_QUOTA` is currently `false` in `functions/.env.ssbmax-49e68`** (tracked in
   git — deliberately, for dev testing; see file header). Must be flipped to `true` (or the
   file deleted) before real launch, alongside the flag decision above.

---

## 4. Per-Type Cutover Checklist (the trigger for closing the fabricated-result-write gap)

**Context:** `gto_results`/`ppdt_results`/`psych_results`/`submissions` in
`firestore.rules` currently allow any authenticated owner to write directly — this is
required for the legacy client-side path to work (it writes its own Gemini result to
Firestore from the device) and is not fixable by tightening rules alone, since rules can
validate shape but never provenance (a client can always assert its own fabricated score).
Locking these down before a type's legacy path is actually gone would break it.

**So: for each type, only do the following once it has genuinely, verifiably earned
Cutover (not just "flag is true today"):**

- [ ] OIR — N/A, already the target end state (no legacy path, nothing to lock further for this type specifically — but see §5, OIR still shares `submissions` writes with unmigrated types)
- [ ] WAT — bake criteria met → delete `PsychAnalysisOrchestrators.kt`'s WAT path → lock `psych_results`/`submissions` WAT writes to Admin-SDK-only
- [ ] SRT — same, SRT path
- [ ] SD — same, SD path
- [ ] PPDT — bake criteria met → delete `PPDTAnalysisOrchestrator.kt` → lock `ppdt_results` writes to Admin-SDK-only
- [ ] TAT — bake criteria met → delete `TATAnalysisOrchestrator.kt` → lock `psych_results` TAT writes to Admin-SDK-only
- [ ] GTO — bake criteria met → delete `GTOAnalysisOrchestrator.kt` → lock `gto_results` writes to Admin-SDK-only
- [ ] Interview — bake criteria met → delete `InterviewAnalysisOrchestrator.kt` → lock `interview_responses`/`interview_results` writes further (ownership-only today; already has the `checkInterviewPrerequisites` server gate as of 2026-08-16, see §6)

**Note:** `submissions`, `psych_results`, `gto_results`, and `ppdt_results` are each shared
by multiple types. A collection can only be locked down once *every* type still writing to
it has cut over — check which types share a collection before flipping any one rule.

---

## 5. Known Gap, Deliberately Not Fixed Yet

`gto_results`/`ppdt_results`/`psych_results`/`submissions` currently permit a client to
write a fabricated "completed" result directly to Firestore, bypassing evaluation
entirely, for any type still on the legacy path (i.e., all 7 non-OIR types today, per §2).
This is real and was found in the 2026-08-16 audit. **Deliberately not fixed by patching
rules** — see the checklist in §4 for why, and the reasoning: rules enforce shape, not
provenance; the only durable fix is finishing Cutover, then locking down in the same
change that deletes the legacy writer. Revisit this section's checkboxes, not the rules
file directly, when a type is ready.

---

## 6. Changes Already Made (2026-08-16 audit + fixes)

- `submitInterviewResponse` (`functions/src/submissions.js`) now calls
  `checkInterviewPrerequisites` — server-side PIQ/PPDT-submitted + OIR≥50% + quota gate,
  previously enforced only client-side (KMP) and trivially bypassable via web or a direct
  API call.
- Quota is now charged server-side inside `runEvaluation`/`evaluateGTOSubmission`/
  `evaluateInterviewResponseCore` themselves (keyed by `submissionId`, or `sessionId` for
  Interview to avoid over-charging a multi-response session), closing a gap where charging
  only happened if the client separately, voluntarily called `recordTestUsage` afterward.
- `interview_questions` is now `allow write: if false` in `firestore.rules` — no
  legitimate client writer existed anywhere in the app.
- Blank-submission-ID crash guard (GitLive's `.document("")` crashes uncatchably on iOS)
  pushed from two patched call sites in `GetOLQDashboardUseCase.kt` down into every
  repository method across all 9 `GitLive*Repository`/`*Delegate`/`*Store` files in
  `data-firebase`.
- **2026-08-17 (Phase 1, Centralized Result-Announcement Notifications plan):** every
  evaluation-completion write now also calls `notifyEvaluationComplete`
  (`functions/src/notifications/sendNotification.js`), writing an
  `SSBMaxNotification`-shaped doc to `NOTIFICATIONS`. Hooked at each pipeline's existing
  completion site, no dispatcher refactor: `core.js::runEvaluation` (covers SD/SRT/WAT in
  one call site), plus `ppdtEvaluate.js`, `tatEvaluate.js`, `gtoEvaluate.js` individually
  at their `COMPLETED` flip. `interviewEvaluate.js` has no session-level `COMPLETED` flip
  (per-response evaluation is plan-locked, see that file's class doc) — it notifies once
  per successfully evaluated response instead, which may be noisier than intended (many
  responses per interview session); flagged for revisit if UX feedback says so, not fixed
  here since it would require restructuring interview's completion model, out of Phase 1
  scope. This note does not change any type's Cutover status above — the notify hook fires
  regardless of Cutover state, since it's attached to each pipeline's real completion write
  either way.
