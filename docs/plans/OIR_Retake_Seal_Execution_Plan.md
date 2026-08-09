# OIR Retake Seal — Execution Plan

**Status:** Decision confirmed — **Option B (architectural)**. Rationale: no production users yet (dev-mode only), so the blast-radius/regression-risk tradeoff that favored Option A no longer applies. See Section 3.
**Target branch:** `feature/OIR_Impr_01`
**Scope:** Seal OIR retake correctness: a retake must persist its own result and count against the monthly quota. Fixes two defects sharing one root cause (reused submission id).
**Source architecture:** `docs/architecture/OIR_Architecture.md`
**Production content baseline:** Firestore project `ssbmax-49e68`, `contentVersion = 4`, 28 canonical batches, 1,255 questions.

---

## 1. Problem statement

OIR reuses `submissionId == sessionId == {userId}_{testId}` across retakes (the session doc is "reused, not re-minted" per the architecture doc). Two defects follow from that reuse:

### Defect 1 — Retake shows a stale result

`GitLivePersonalTestSubmissionRepository.submitOIR` has an idempotency guard that returns early if the submission doc already exists:

```kotlin
val existing = submissionsCollection.document(submission.id).get()
if (existing.exists) {
    if (existing.data[FIELD_USER_ID] == submission.userId &&
        existing.data[FIELD_TEST_TYPE] == TestType.OIR.name) {
        Result.success(submission.id)   // ← returns early, does NOT write today's result
    } else { ... }
}
```

Because the doc id is reused across retakes, a retake is indistinguishable from a retry of the same attempt. The guard silently drops every retake's result. The result screen (`OirResultViewModel` → `GitLiveOirResultRepository.getOirResult(submissionId)`) then reads the **first-ever attempt's** result.

**Verified in production (Firestore, `ssbmax-49e68`):**
- `test_sessions/{userId}_oir_standard`: today's run, `status: SUBMITTED`, `isActive: false` ✅
- `submissions/{userId}_oir_standard`: `submittedAt` = Aug 7, `rawScore: 20`, `correctAnswers: 10`, `difficultyBreakdown` present ❌ stale
- Query "submissions created today": **empty** — today's run never persisted its result.

The `rawScore 20 ≠ correctAnswers 10` is a **symptom**, not a separate bug: the stale doc was written by pre-difficulty-free code. Current `OIRTestScoreCalculator` sets `rawScore = correctAnswers` (line 24) and `difficultyBreakdown = emptyMap()` (line 61).

### Defect 2 — Retake bypasses the monthly quota

`GitLiveTestUsageRecorder.recordTestUsage` has the same reused-id problem:

```kotlin
if (submissionId != null && existing?.recordedSubmissionIds?.contains(submissionId) == true) {
    return@runTransaction   // ← skips the increment
}
```

Because the id is reused, the second retake in the same month is never counted. **Verified in production:** the Aug 2026 usage doc's `recordedSubmissionIds` contains `MEkxQsweaEhNYFa0LeTJgCUDqVc2_oir_standard`, and `oirTestsUsed` is absent — today's retake did not increment it. A FREE user (1 OIR/month) can retake OIR indefinitely without being charged.

### Root cause

Both defects share one root cause: **a reused id is used as an idempotency key, but idempotency keys must be unique per logical operation.** The current code conflates "retry of the same attempt" (should be idempotent) with "retake" (a new attempt that must write and count).

---

## 2. The decision — two options

Both options fix Defect 1. They differ in how they fix Defect 2 and in blast radius.

### Option A — Minimal: overwrite + unconditional OIR usage count (not chosen)

**Submission:** remove the early-return guard. Always write the submission for the same user + same test type. A true retry of the same attempt produces an identical result (deterministic `OIRTestScoreCalculator`), so overwriting is still idempotent in effect. Keep the identity-conflict guard (different user/test type → fail).

**Usage:** for OIR, **always increment** — ignore the `recordedSubmissionIds` dedup.

**Pros:** minimal, surgical, no navigation/session-model/DTO changes, fastest to seal.

**Cons:** loses the concurrent-retry dedup for OIR usage; overwrite semantics lose per-attempt audit trail; and — the deciding factor against it — it permanently bakes a `testType == OIR` special case into `GitLiveTestUsageRecorder`, the one place where OIR's usage-counting logic diverges from every other test type (PPDT/TAT/WAT/SRT/SDT), which already use fresh ids and the standard dedup path.

### Option B — Architectural: fresh submission id per attempt (chosen)

**Submission:** mint a fresh id per attempt; `submissionId != sessionId` for OIR. The session id stays the durable session identity; the submission id is unique per attempt.

**Usage:** the `recordedSubmissionIds` dedup works correctly again (fresh ids are unique), so no usage-logic change is needed — OIR uses the exact same path as every other test type.

**Pros:**
- Cleanest long-term architecture — idempotency keys are truly unique.
- Per-attempt audit trail (every result survives).
- Usage dedup remains meaningful, with zero OIR-specific branching.
- Aligns with how PPDT/TAT/WAT/SRT/SDT already work (fresh submission ids) — removes OIR as the one inconsistent test type instead of adding a second inconsistency (a usage-layer special case) on top of the existing one.

**Cons (accepted, see Section 3):**
- Larger blast radius: touches `SubmitOIRTestUseCase` (mint id, pass through), `OIRTestViewModel` (store the returned submission id, not the session id), result-screen navigation (`test/oir/result/{submissionId}`), and any code that assumes `submissionId == sessionId` for OIR.
- Bigger change to test and verify on-device.

---

## 3. Recommendation

**Option B.** The original recommendation favored Option A on the grounds that the two defects were live in production and minimizing blast radius mattered more than architectural cleanliness. That tradeoff no longer holds: **the app is in dev mode with no production users**, so there is no user-facing regression risk to protect against, and no existing submission history to migrate. This is the cheapest point in the project's life to make OIR consistent with the other five test types — the cost only goes up once there are real users, active sessions, or submission history depending on the reused-id shape.

Choosing Option B now also avoids ever building the Option A usage-layer special case at all, so there is no later cleanup phase required to remove it.

---

## 4. Non-negotiable execution rules

These apply to every phase (mirrors `OIR_Impr_Execution_Plan.md`).

### 4.1 Phase gate
- Work one phase at a time. A phase is incomplete until implementation, tests, build, and checks pass.
- Do not begin the next phase while any phase gate is failing.
- Do not hide, weaken, skip, or delete a failing test to obtain a green build.
- Record unrelated pre-existing failures separately; do not claim a phase passed until the changed scope is verified.

### 4.2 TDD
For every behavior change:
1. Add/update a failing test expressing the desired behavior.
2. Implement the smallest correct change.
3. Refactor without changing behavior.
4. Run the narrowest relevant test.
5. Run the complete phase test suite.
6. Run the project build/check gate.

Tests must cover both success and failure/security paths.

### 4.3 Architecture and code quality
- Preserve MVVM: repositories own persistence/network access.
- Keep domain rules in `shared`; platform code behind interfaces.
- No file may exceed 300 lines — split before crossing.
- Use `ErrorLogger`/`DomainLogger` per module rules; no `printStackTrace()`.
- No mutable singleton state.

### 4.4 Security rules
- Preserve immutable identity fields: `userId`, `testType`, submission ID, session ID.
- Keep the identity-conflict guard (different user/test type on a colliding id must fail).
- Usage recording stays idempotent by submission id via the existing `recordedSubmissionIds` dedup — **no OIR-specific branch**; every test type, including OIR, uses the same path.
- Only the use case may mint a submission id; no client-supplied id is trusted.
- Firestore rules must be tested for authorized and unauthorized writes.
- No production Firestore writes during code phases unless the phase explicitly requires it.

### 4.5 Required phase handoff
At the end of every phase, provide a Phase Summary: changes completed, tests added/executed, build/check commands + results, tech debt + resolution, remaining risks, and confirmation the gate passed. No next phase begins until the summary is accepted.

---

## 5. Baseline and branch safety

Before Phase 1:
- Confirm the working tree is clean or document existing user changes (currently only `.idea/` noise).
- Confirm the branch is `feature/OIR_Impr_01`.
- Record the baseline:
  ```bash
  ./gradlew :shared:testDebugUnitTest --tests "*OIR*" --tests "*PPDT*"
  ./gradlew :data-firebase:testDebugUnitTest --tests "*OIR*" --tests "*PPDT*"
  firebase emulators:exec --only firestore --project demo-ssbmax-rules-test "npm --prefix firestore-tests test"
  ```
- Baseline status (recorded 2026-08-09): all three pass. Firestore rules 16/16 pass.

---

# Phase 0 — Blast-radius audit: find hidden `submissionId == sessionId` assumptions

**Priority:** P0 (gates Phase 1)
**Goal:** Phase 1's scope (Section 1.1) asserts a fixed list of files that need to change for Option B. That list is an assertion, not a verified fact — Option A's tests/phase gates would never catch code outside OIR's own use case/ViewModel/navigation (analytics events, deep links, notification payloads, admin/review tooling) that silently relies on the two ids being identical for OIR. This phase verifies the list is complete before Phase 1 changes the identity model.

## 0.1 Method

Grep the codebase (all modules: `shared`, `data-firebase`, `app`, iOS Swift sources) for:
- OIR-adjacent code that reads `session.sessionId` and passes it somewhere a submission id is expected (analytics event params, deep-link URIs, push-notification payloads, admin/support tooling, crash-report breadcrumbs).
- Any comment, doc, or test asserting `submissionId == sessionId` for OIR specifically.
- Non-Kotlin references (Firestore security rules, Cloud Functions, `firestore-tests/*.mjs`) that key off the OIR submission doc id and assume it matches the session doc id.

## 0.2 Findings (audit run 2026-08-09)

Grepped all Kotlin sources for `sessionId` co-occurring with OIR, then read every hit in context.

| # | Location | What it does | Disposition |
|---|---|---|---|
| 1 | `shared/.../navigation/SSBMaxDestinations.kt:109-120` — `OIRTestResult(val sessionId: String)`, `OIRAnswerReview(val sessionId: String)`, routes `test/oir/{result,review}/{sessionId}` | The nav-route SSOT names the OIR result/review route params `sessionId`, even though after Phase 1 the value flowing through is the submission id. Every other test type's equivalent destination (`TATSubmissionResult`, `PPDTSubmissionResult`, etc.) names it `submissionId`. | **(b) Folded into Phase 1.** Rename both fields to `submissionId` and update the two route templates' path segment name to match. This is the nav SSOT (`CLAUDE.md` §"Guiding Principles") — leaving a field that actually holds a submission id named `sessionId` is exactly the kind of migration-debt drift `CLAUDE.md`'s "KMP Migration: Expect and Fix Debt" section says to fix, not route around. |
| 2 | `shared/.../navigation/PsychTestsGraph.kt:35,55` — `val submissionId = backStackEntry.toRoute<...>().sessionId` | Reads the route's `sessionId` field into a locally-named `submissionId` val — confirms the code already conceptually treats this as a submission id, just via a misleadingly named field. | **(b) Folded into Phase 1**, mechanical consequence of #1 — becomes `.submissionId` once the field is renamed. |
| 3 | `shared/.../navigation/TestResultHandler.kt:32` — KDoc: `@param submissionId The ID of the submitted test (or sessionId for OIR)` | Cross-test-type SSOT for post-submission routing. The function logic already treats `submissionId` generically for every test type, including OIR (line 61 just forwards it) — **no logic change needed**. Only the doc comment calls out a special case. | **(b) Folded into Phase 1/3 cleanup.** Delete the `(or sessionId for OIR)` caveat from the KDoc — it becomes false once Phase 1 lands, and a stale doc comment on an SSOT file is worse than none (`CLAUDE.md` "Fail loud" / don't leave known-stale docs). |
| 4 | `shared/.../domain/usecase/dashboard/GetOLQDashboardUseCase.kt:319` — `oirResult = oirResult?.copy(sessionId = oirSubmission?.id ?: "")`, comment `// CRITICAL: Ensure sessionId matches document ID for navigation consistency` | Reconciles the dashboard's displayed OIR result to carry the submission doc's own id, for navigation. `oirSubmission` comes from `submissionRepository.getLatestOIRSubmission(userId)`. | **(a) Confirmed unaffected — verified, not assumed.** Read `GitLivePersonalTestSubmissionRepository.getLatestOIRSubmission` (`data-firebase/.../GitLivePersonalTestSubmissionRepository.kt:174-189`): it already runs a real query — `where userId, where testType == OIR, orderBy(submittedAt, DESCENDING), limit(1)` — not a fixed-id `get()`. Once Phase 1 creates one doc per attempt, this query naturally returns the most recent one. No code change required. Add a characterization test anyway (Phase 3) pinning "dashboard reflects the most recent of N submissions" so this can't silently regress if someone later "simplifies" the query back to a fixed-id get. |
| 5 | `shared/.../domain/usecase/CheckInterviewPrerequisitesUseCase.kt:165,210` — also calls `getLatestOIRSubmission` (drives the PIQ/OIR/PPDT completion gate and the interview subscription gate — see `CLAUDE.local.md`'s Developer Settings → Bypass Interview Prerequisites) | Same repository method as #4. | **(a) Confirmed unaffected**, same reasoning as #4 — already query-based, not fixed-id. |
| 6 | `data-firebase/.../OIRSubmissionMappers.kt:29,71,98` — `OIRSubmissionTestResultDto.sessionId` | A field on the *result payload* recording which session produced it (audit metadata), distinct from the submission doc's own `id`. Set via `OIRTestScoreCalculator.sessionId = session.sessionId`. | **(a) Confirmed unaffected** — legitimately session-scoped metadata, was never a doc-id proxy, continues to be correct after Phase 1. |
| 7 | `app/.../TestProgressTrackingContractTest.kt` | Only asserts `getPhase1Progress` queries `testType == "OIR"` as a string filter. No id-equality assumption. | **(a) Confirmed unaffected.** |
| 8 | `OIRAnswerReviewScreen.kt`, `SubmissionDetailViewModel.kt` | Consume `submissionId` generically (already passed as a generic param from `PsychTestsGraph.kt`, per #2); grep found no `sessionId` references in either file. | **(a) Confirmed unaffected.** |
| 9 | `shared/.../presentation/oir/OIRTestUiState.kt:34` — `val sessionId: String? = null`, plus its writer `OIRTestViewModel.kt:243` (`sessionId = submissionId`) and reader `OIRTestScreen.kt:81-82` (`onTestComplete(uiState.sessionId!!, ...)`) | **Missed in the original 2026-08-09 audit pass** — present in the raw grep output but not individually dispositioned; caught during Phase 1 implementation when tracing how the fresh id reaches navigation. The ViewModel already stores the use case's *returned* id here (not `session.sessionId` directly), so no behavior change was needed — but the field name is the same category of stale-naming debt as #1. | **(b) Folded into Phase 1**, discovered late — see Phase 1 implementation notes. Renamed to `submissionId` for consistency with #1–#3, since leaving it would reintroduce the exact naming confusion this phase exists to remove. |

## 0.3 Phase gate

- Every hit above has a disposition (5 confirmed unaffected, 4 folded into Phase 1/3). Finding #9 was missed on the first pass and caught mid-Phase-1 — recorded here for an accurate audit trail rather than silently folded in.
- Phase 1's scope (Section 1.1) is updated to include findings #1–#3 and #9. Phase 3's test list is updated to include a regression test for finding #4.
- Gate passed 2026-08-09 — proceeding to Phase 1.

---

# Phase 1 — Fresh submission id per attempt (Defect 1)

**Priority:** P0
**Goal:** Each OIR attempt gets its own submission id, decoupled from the durable session id, so a retake writes a new result instead of colliding with the prior attempt.

## 1.1 Scope

- `shared/.../domain/usecase/oir/SubmitOIRTestUseCase` — mint a fresh id per invoke instead of reusing `session.sessionId`; use the same id-generation approach already used by PPDT/TAT/WAT/SRT/SDT (do not introduce a second UUID strategy).
- `shared/.../ui/oir/OIRTestViewModel` — already stores the id *returned by the use case* (not `session.sessionId` directly, confirmed by reading `submitTest()`), so no behavior change is needed here — only the naming fix below (finding #9).
- `shared/.../presentation/oir/OIRTestUiState.kt` — rename `sessionId` → `submissionId`; update the writer (`OIRTestViewModel.kt:243`) and reader (`OIRTestScreen.kt:81-82`, `onTestComplete` callback param). Phase 0 finding #9 (caught during Phase 1 implementation, not the original audit pass).
- `shared/.../navigation/SSBMaxDestinations.kt` — rename `OIRTestResult.sessionId` → `submissionId` and `OIRAnswerReview.sessionId` → `submissionId` (route path segments follow suit: `test/oir/result/{submissionId}`, `test/oir/review/{submissionId}`). Found in the Phase 0 audit (finding #1) — every other test type's result destination already names this param `submissionId`; OIR was the last one still named `sessionId`, and after Phase 1 the value it carries genuinely is a submission id.
- `shared/.../navigation/PsychTestsGraph.kt:35,55` — mechanical follow-on of the rename above (`.toRoute<...>().sessionId` → `.submissionId`). Phase 0 finding #2.
- `shared/.../navigation/TestResultHandler.kt:32` — delete the stale KDoc caveat `(or sessionId for OIR)`; no logic change (the function already forwards `submissionId` generically for every test type). Phase 0 finding #3.
- `data-firebase/.../GitLivePersonalTestSubmissionRepository.kt` — `submitOIR`: no logic change expected. The existing idempotency guard now only fires on a genuine same-id retry (correct behavior); confirm this holds rather than rewriting it.

## 1.2 TDD tests first

Updated file: `shared/src/androidUnitTest/.../domain/usecase/oir/SubmitOIRTestUseCaseTest.kt`

| # | Test | Expect | Rationale |
|---|---|---|---|
| 1 | `invoke mints a submission id distinct from the session id` | `submissionId != session.sessionId` | **Core fix** — decouples attempt identity from session identity |
| 2 | `invoke mints a different submission id on each call for the same session` | two invokes → two distinct ids | Proves a retake gets a genuinely new attempt id, not a derived/cached one |
| 3 | `submitOIR is invoked with the freshly minted id, not the session id` | mock captures argument | Pins the wiring so this can't silently regress to the old reused-id pattern |

New/extended file: `data-firebase/src/androidUnitTest/kotlin/com/ssbmax/shared/data/repository/GitLiveOIRSubmissionWritePolicyTest.kt` — characterization tests confirming the existing identity-conflict guard is unchanged and still correct for the now-rare genuine-retry case:

| # | Test | existing | incoming | Expect |
|---|---|---|---|---|
| 4 | `retry with the same submission id is idempotent (no error, same result)` | `u1`/`OIR` | `u1`/`OIR` (same id) | success, no duplicate side effect |
| 5 | `conflicting user on a colliding id is rejected` | `u2`/`OIR` | `u1`/`OIR` | rejected |
| 6 | `conflicting test type on a colliding id is rejected` | `u1`/`PPDT` | `u1`/`OIR` | rejected |

**Red:** tests 1–3 fail against current code (use case passes `session.sessionId`, not a fresh id) — legitimate TDD red. Tests 4–6 should already pass; if not, that is a pre-existing bug to fix here, not a new one to introduce.

## 1.3 Implementation steps

1. In `SubmitOIRTestUseCase`, mint a fresh id and set it as `OIRSubmission.id` instead of `session.sessionId`.
2. In `OIRTestViewModel`, capture the `submissionId` from the use case's result and use it (not `session.sessionId`) for result-screen navigation.
3. Rename `SSBMaxDestinations.OIRTestResult`/`OIRAnswerReview`'s `sessionId` field and route segment to `submissionId`; update `PsychTestsGraph.kt`'s two `.toRoute<...>()` reads to match.
4. Delete the stale `(or sessionId for OIR)` caveat from `TestResultHandler.handleTestSubmission`'s KDoc.
5. Leave `GitLivePersonalTestSubmissionRepository.submitOIR` and `GitLiveOirResultRepository` unmodified; confirm via their existing test suites.

## 1.4 Security checks

- Confirm the identity-conflict guard still rejects a colliding id from a different user/test type (should now be unreachable in normal operation, but must not regress).
- Confirm no client path can supply its own submission id — the use case is the sole minter.

## 1.5 Phase gate

```bash
./gradlew :shared:testDebugUnitTest --tests "*SubmitOIRTestUseCase*"
./gradlew :data-firebase:testDebugUnitTest --tests "*OIRSubmissionWritePolicy*"
./gradlew :data-firebase:testDebugUnitTest --tests "*OIR*"
```

Run diagnostics for all changed files. Do not proceed if any new warning/error is unexplained.

---

# Phase 2 — Usage quota integrity verification (Defect 2)

**Priority:** P0
**Goal:** Confirm every OIR attempt counts against the monthly quota now that each attempt has a unique submission id. **No `GitLiveTestUsageRecorder` logic change expected** — this phase verifies the existing dedup path works correctly for OIR once ids are unique, per Section 3's SSOT rationale (no OIR-specific branch).

## 2.1 Scope

- `data-firebase/.../GitLiveTestUsageRecorderTest.kt` — new OIR cases exercised against the existing, unmodified `recordTestUsage`.

## 2.2 TDD tests first

| # | Test | Expect | Rationale |
|---|---|---|---|
| 1 | `OIR retake with a fresh submission id increments usage` | `oirTestsUsed` incremented | **Core fix** — the quota bug, solved by id uniqueness, not new usage logic |
| 2 | `OIR first attempt increments usage` | incremented | Sanity |
| 3 | `a genuine retry with the same submission id does not double-count` | not incremented twice | Confirms the existing dedup still protects against real retries — same guarantee TAT/WAT/PPDT already rely on |

**Red/Green:** these are expected to pass against `recordTestUsage` unmodified, once Phase 1 lands — characterization tests. If any fails, that indicates a latent dedup bug independent of the reused-id root cause, and must be fixed in this phase.

## 2.3 Implementation steps

1. Add the three tests.
2. Run against the existing `recordTestUsage` unmodified.
3. Only touch `GitLiveTestUsageRecorder` if a test fails for a reason unrelated to id reuse — and if so, the fix must apply uniformly to all test types, not just OIR.

## 2.4 Security checks

- Confirm no OIR-specific branch exists anywhere in `recordTestUsage` (SSOT: one usage-counting path for every test type).
- Confirm the usage write shape still satisfies the Firestore `subscription/{document}` rule (Section 24 of `PPDT_Pipeline.md` — `document == 'usage_' + month`, monotonic increments).

## 2.5 Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest --tests "*UsageRecorder*"
```

---

# Phase 3 — Use-case orchestration and navigation regression tests

**Priority:** P1
**Goal:** Pin the new identity model (`submissionId != sessionId`) at the orchestration, ViewModel, and navigation layers so it cannot be silently reverted to the reused-id pattern.

## 3.1 Scope

- `shared/.../domain/usecase/oir/SubmitOIRTestUseCaseTest.kt` (extends Phase 1 tests)
- `shared/.../ui/oir/OIRTestViewModelTest.kt`
- Navigation/result-screen test covering `test/oir/result/{submissionId}`
- `shared/.../domain/usecase/dashboard/GetOLQDashboardUseCaseTest.kt` — Phase 0 finding #4 follow-through

## 3.2 TDD tests first

| # | Test | Expect |
|---|---|---|
| 1 | `invoke always calls submitOIR for a retake (never short-circuits)` | `submitOIR` called exactly once per invoke |
| 2 | `invoke records usage for every attempt` | `recordTestUsage` called exactly once per invoke |
| 3 | `invoke passes a freshly minted id, not the session id, as the submission id` | `submitOIR` receives an id distinct from `session.sessionId` |
| 4 | `OIRTestViewModel navigates to the result route using the returned submission id` | route param equals the use case's returned id, not the session id |
| 5 | `result screen loads by submission id and reflects the most recently submitted attempt` | integration-level check across two sequential submits |
| 6 | `dashboard reflects the most recent of multiple OIR submissions for a user` | given `getLatestOIRSubmission` returns two attempts across separate stub calls (or one that already reflects the query's `orderBy(submittedAt DESC)`), the dashboard's `oirResult.sessionId` equals the newest submission's `id` | Characterization test for Phase 0 finding #4 — `getLatestOIRSubmission` already queries correctly, this pins that behavior so it can't silently regress to a fixed-id lookup |

## 3.3 Implementation steps

1. Add the five tests.
2. Confirm green; fix any wiring gap surfaced.

## 3.4 Phase gate

```bash
./gradlew :shared:testDebugUnitTest --tests "*SubmitOIRTestUseCase*"
./gradlew :shared:testDebugUnitTest --tests "*OIRTestViewModel*"
```

---

# Phase 4 — Firestore rules verification

**Priority:** P1
**Goal:** Confirm the retake path is legal under the current rules now that each attempt writes a **new** document instead of overwriting an existing one.

## 4.1 Analysis

- With Option B, `submitOIR` writes a **fresh document id** per attempt, so a retake is governed by the Firestore `submissions` **create** rule (not `update`, as an overwrite-based design would require) — the create rule requires the OIR `test_sessions` doc to exist.
- The `test_sessions/{userId}_oir_standard` doc remains session-scoped and reused (unaffected by this change); confirm it still exists and is active at retake time, satisfying the create rule's precondition.
- This is a change from the plan's earlier draft, which assumed the `update` rule would govern an overwrite. Phase 4 must verify against the `create` path instead.

## 4.2 TDD / rules tests

Add a rules test: creating a **second** OIR submission doc (distinct id, same `test_sessions` doc) for the same user succeeds under the `create` rule. Run the full suite to confirm no regression:

```bash
firebase emulators:exec --only firestore --project demo-ssbmax-rules-test "npm --prefix firestore-tests test"
```

If a rules change is needed, follow the `PPDT_Pipeline.md` §25 playbook: write a failing `firestore-tests/*.rules.test.mjs` first, prove it fails on the old rule, fix, prove it passes, deploy, verify live.

## 4.3 Phase gate

```bash
firebase emulators:exec --only firestore --project demo-ssbmax-rules-test "npm --prefix firestore-tests test"
```

---

# Phase 5 — On-device verification and seal

**Priority:** P0
**Goal:** Prove on the real device that a retake writes its own new submission and counts against quota.

## 5.1 Manual smoke (Pixel 9, `tokay`)

1. **Fresh first OIR test** → submit → note the result (score, category breakdown) and the submission id.
2. **Retake OIR** → submit → **verify the result screen shows the NEW attempt's score**, and that a **second, distinct submission document** now exists in Firestore alongside the first. This is the core seal check.
3. **Exit mid-test → retake immediately** → must succeed (the stuck-ACTIVE guard from #15/#16 — already passing, re-confirm).
4. **Verify quota:** after ≥2 attempts in the same month, confirm `oirTestsUsed` incremented per attempt (via Firestore query, not the client).

## 5.2 Firestore verification (source of truth)

```bash
# After a retake, confirm:
#   - a NEW submissions/{freshId} doc exists (submittedAt == today, rawScore == correctAnswers, no difficultyBreakdown)
#   - the ORIGINAL submissions/{oldId} doc is untouched (still shows the first attempt)
#   - test_sessions/{userId}_oir_standard remains a single, reused, session-scoped doc
#   - oirTestsUsed incremented per attempt
```

## 5.3 Log capture

```bash
adb logcat -v time | grep -E "OIRTestViewModel|PERMISSION_DENIED|Write failed at|SubmitOIRTestUseCase"
```

No `PERMISSION_DENIED`, no `Write failed`.

## 5.4 Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest --tests "*OIR*"
./gradlew :shared:testDebugUnitTest --tests "*OIR*"
./gradlew check
```

---

## 6. Cross-phase validation matrix

| Behavior | Phase | Primary validation |
|---|---|---|
| Retake writes a new submission with a fresh id | 1 | `SubmitOIRTestUseCaseTest` |
| Genuine same-id retry stays idempotent; conflicting user/test type rejected | 1 | `GitLiveOIRSubmissionWritePolicyTest` cases 4–6 |
| Every OIR attempt counts against quota, via the standard (unmodified) dedup path | 2 | `GitLiveTestUsageRecorderTest` |
| No OIR-specific usage branch introduced (SSOT with other test types) | 2 | Code review + Phase 2 security checks |
| Use case never short-circuits a retake; submission id flows correctly to navigation | 3 | `SubmitOIRTestUseCaseTest`, `OIRTestViewModelTest` |
| Rules allow the create-per-attempt path | 4 | `firestore-tests` suite |
| Real-device retake creates a new result doc + counts quota | 5 | Manual smoke + Firestore query |

---

## 7. Final release gate

- All phase gates green.
- `./gradlew check` green (or pre-existing failures documented separately).
- On-device retake verified: result screen shows the new attempt; a distinct submission doc exists per attempt; `oirTestsUsed` incremented.
- No production Firestore rules deployed unless Phase 4 determined a change was required.
- Phase Summary for each phase accepted.

---

## 8. Decision record

**Resolved 2026-08-09: Option B.** Originally Option A was recommended to minimize blast radius against live production defects. Since the app has no production users yet (dev mode only), that tradeoff no longer applies, and the architecturally consistent fix (fresh id per attempt, matching PPDT/TAT/WAT/SRT/SDT, zero OIR-specific branching) was chosen instead. Phases 1–4 above reflect Option B throughout.
