# OIR Difficulty Removal Execution Plan

**Status:** Phase 6 implementation and automated release gate complete; manual smoke evidence remains release-operator work
**Parent plan:** `docs/plans/OIR_Impr_Execution_Plan.md`
**Scope:** Remove Easy/Medium/Hard classification from the OIR product while preserving valid-question selection, 20/20/10 distribution, subscription enforcement, durable sessions, scoring integrity, result persistence, and answer review.
**Target branch:** `feature/OIR_Impr_01`
**Production baseline:** 28 canonical batches, 1,255 records, 1,069 currently valid records, 186 skipped records, 529 verified image URLs. All 1,255 production records currently carry `difficulty = MEDIUM`, so difficulty is not reliable content data.

---

## 1. Product decision and non-negotiable contract

### 1.1 Approved product decision

OIR will no longer classify questions as Easy, Medium, or Hard. Difficulty will not affect selection, scoring, result display, or user-facing analytics.

A test will continue to contain exactly:

```text
20 verbal reasoning + 20 non-verbal reasoning + 10 numerical ability = 50 valid questions
```

Within each category, the selector may choose any valid question from the complete eligible pool across all 28 batches. It must not include invalid records merely because difficulty metadata has been removed.

### 1.2 New scoring contract

```text
correct answer = 1 point
incorrect answer = 0 points
skipped answer = 0 points
percentage = correct answers / total questions × 100
```

For a complete 50-question test:

```text
rawScore = correctAnswers
percentageScore = correctAnswers / 50 × 100
```

The existing test-time duration, session expiry, subscription quota, idempotent submission, result persistence, and answer-review behavior remain unchanged.

### 1.3 Backward-compatibility contract

Existing Firestore content and historical OIR submissions may contain difficulty fields. They must remain readable during migration.

- New code must not require `difficulty` to load an OIR question.
- New results must not depend on `difficultyBreakdown`.
- Legacy result documents containing `difficultyBreakdown` must parse safely.
- No historical submission may be deleted or rewritten during code phases.
- Old difficulty fields may remain in Firestore temporarily as ignored legacy fields.

### 1.4 Explicit non-goals

This plan does not:

- Remove question validity checks.
- Change the 20/20/10 category distribution.
- Change subscription limits or usage semantics.
- Add free replay of submitted tests.
- Change session ownership, expiry, or terminal states.
- Change Firestore rules unless compatibility testing proves it necessary.
- Invent Easy/Medium/Hard labels from question numbers, categories, or heuristics.

---

## 2. Rules for every phase

### 2.1 Phase independence

- Work on one phase only.
- Every phase ends with a successful relevant build and all relevant tests passing.
- Do not begin the next phase with a failing build, failing test, unexplained diagnostic, or unresolved tech debt.
- If a phase exposes a pre-existing failure, isolate it, record it, and do not claim the phase passed until changed-scope validation is green.

### 2.2 TDD

For each behavior change:

1. Add or update a failing unit/integration test.
2. Implement the smallest correct change.
3. Refactor without changing behavior.
4. Run focused tests.
5. Run the complete phase test suite.
6. Run the phase build/check gate.

Tests must cover success, malformed/legacy input, security-sensitive boundaries, and compatibility behavior.

### 2.3 Architecture and quality

- Preserve `Compose Screen → ViewModel → UseCase → Repository → Firebase/SQLDelight`.
- Keep OIR distribution and question validity in their existing SSOT locations.
- Keep domain logic in `shared` and Firebase/SQLDelight implementations behind interfaces.
- Do not add Android-only dependencies to `shared/commonMain`.
- No Firebase calls from Compose UI or ViewModels.
- Expose `StateFlow`, use `MutableStateFlow.update`, and avoid mutable singleton state.
- No file may exceed 300 lines of code.
- Navigation remains ID-based.

### 2.4 Resource and UI rules

- No hardcoded user-facing strings.
- No hardcoded colors; use Material theme or semantic design tokens.
- No difficulty-specific UI may remain in the active OIR result flow.
- Zero-question categories must remain hidden.
- Accessibility labels must remain valid after UI changes.

### 2.5 Security and data rules

- Eligibility remains fail-closed.
- Removing difficulty must not weaken question validation or subscription checks.
- Never trust client-provided score, usage, ownership, or status transitions.
- Preserve immutable user/session/submission identity fields.
- Keep usage recording idempotent by submission/session identity.
- Never expose credentials or log complete question content/answers.
- Do not perform production Firestore writes without explicit confirmation.
- If a production metadata cleanup is approved, record the exact command and post-write health result.

### 2.6 Required phase handoff

At the end of every phase, stop and provide:

1. Changes completed.
2. Tests added and executed.
3. Build/check commands and results.
4. Tech debt incurred.
5. Exact steps taken to resolve that debt immediately.
6. Remaining risks or blockers.
7. Confirmation that the phase gate passed.

No next phase begins until the handoff is accepted and the gate is green.

---

## 3. Baseline and success criteria

Before Phase 1:

- Confirm the working tree and branch are safe.
- Record the current commit and parent-plan status.
- Run the narrowest existing OIR tests and diagnostics.
- Run the current production read-only content-health command.
- Capture current result DTO compatibility behavior.
- Confirm all 1,255 production questions currently have `difficulty = MEDIUM` without changing production data.

Baseline commands:

```bash
./gradlew :shared:testDebugUnitTest --tests "*OIR*"
./gradlew :data-firebase:testDebugUnitTest --tests "*OIR*"
./gradlew check
node scripts/check-oir-content-health.js
```

If the full check exceeds the bounded command timeout, record the exact completed tasks and isolate the changed scope. Do not silently treat a timeout as a pass.

### Final success criteria

The initiative is complete only when:

- OIR questions load without difficulty metadata.
- Valid question selection still produces exactly 20/20/10 and 50 total questions.
- Invalid records remain excluded.
- Scoring is transparent: raw score equals correct answers.
- Existing and new submissions load safely.
- Difficulty breakdown is absent from the active OIR result experience.
- Review Answers, Take Another Test, and Back to Home remain correct.
- Subscription gates still block a new test at quota exhaustion.
- No difficulty-specific hardcoded strings/colors remain in active OIR UI.
- Content tooling no longer hardcodes `difficulty = MEDIUM` for new OIR content.
- All phase tests, diagnostics, security checks, and required builds pass.
- No unresolved tech debt was introduced by the migration.

---

# Phase 1 — Domain contract and scoring migration

**Goal:** Establish difficulty-free OIR domain and scoring contracts before changing persistence or UI.

## Scope

- Remove difficulty weighting from `OIRTestScoreCalculator`.
- Make raw score equal correct-answer count.
- Make percentage equal correct answers divided by total questions.
- Remove or deprecate `DifficultyScore` and `difficultyBreakdown` from active OIR result modeling.
- Preserve skipped/incorrect counting and multi-select correctness.
- Preserve category scoring and average timing.

## TDD tests first

Add/update tests for:

- One correct question produces raw score 1 and percentage 100%.
- Ten correct answers in a 50-question session produce raw score 10 and percentage 20%.
- Easy/Medium/Hard values, if present in legacy test fixtures, do not change the score.
- Incorrect answers score zero.
- Skipped answers score zero and remain counted as skipped.
- Multi-select scoring remains exact-set based.
- Category scores remain correct.
- A session with no questions fails safely or returns the established empty result behavior.

## Implementation

1. Update the domain result contract.
2. Update score calculation and remove difficulty points from the formula.
3. Keep legacy fields readable at repository boundaries until Phase 2 is complete.
4. Update focused tests and test fixtures.
5. Check file sizes and remove unused imports/types.

## Security checks

- Confirm score is calculated from server-persisted question/answer identity, not a client-provided `isCorrect` flag.
- Confirm submission ownership and session identity are unchanged.
- Confirm removing difficulty cannot bypass eligibility or usage recording.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest --tests "*OIRTestScoreCalculatorTest"
./gradlew :shared:testDebugUnitTest --tests "*SubmitOIRTestUseCaseTest"
./gradlew :shared:compileDebugKotlinAndroid
./gradlew check
```

---

# Phase 2 — Persistence and legacy-result compatibility

**Goal:** New OIR results no longer depend on difficulty while old Firestore/SQLDelight data remains readable.

## Scope

- Update OIR result DTOs and canonical mappers.
- Make `difficultyBreakdown` optional/ignored for new results.
- Safely parse historical submissions that still contain difficulty fields.
- Update SQLDelight adapters/entities only as needed; prefer compatibility-safe retention before destructive schema changes.
- Ensure result cache fallback behaves identically for legacy and new records.

## TDD tests first

Add/update tests for:

- New result round-trip without difficulty breakdown.
- Legacy result with a complete difficulty breakdown parses without failure.
- Legacy result with malformed difficulty keys is safely ignored.
- Legacy result with missing optional difficulty fields still loads.
- New result and cached result produce the same domain result.
- Full answered-question review data still round-trips.
- Submission retry remains idempotent after the result model change.

## Implementation

1. Update DTOs and canonical mapper.
2. Remove difficulty from new serialization paths.
3. Preserve tolerant parsing for old documents.
4. Update cache read/write mapping.
5. Remove unused difficulty-specific persistence code only after compatibility tests pass.

## Security checks

- Confirm historical results cannot be used to modify finalized submissions.
- Confirm malformed legacy data cannot crash result loading.
- Confirm submission ID, user ID, test type, and session ID remain immutable.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest --tests "*Submission*"
./gradlew :data-firebase:testDebugUnitTest --tests "*Result*"
./gradlew :data-firebase:compileKotlinAndroid
./gradlew check
```

---

# Phase 3 — Difficulty-free question cache and selector

**Goal:** Select any valid question from the full eligible pool without depending on difficulty metadata.

## Scope

- Remove difficulty filtering from OIR selector APIs.
- Keep category distribution as the only selection distribution: 20/20/10.
- Keep 7-day reuse preference.
- Keep selection-time validation and top-up behavior.
- Allow missing or legacy difficulty fields in cached question records.
- Preserve two-phase cache readiness and exact 50-question invariant.

## TDD tests first

Add/update tests for:

- A cache containing missing difficulty values still selects valid questions.
- A mixed legacy cache selects from all eligible records regardless of difficulty.
- Exactly 20 verbal, 20 non-verbal, and 10 numerical questions are selected.
- Spatial questions are not selected because the runtime distribution excludes them.
- Invalid questions are filtered and cannot produce a partial test.
- Missing batches and content-version reconciliation still work.
- 7-day reuse preference still works.
- A cache with insufficient valid questions fails closed.
- The selector never trusts a caller-provided difficulty to alter the OIR contract.

## Implementation

1. Remove OIR difficulty arguments from the selector where no longer needed.
2. Stop applying difficulty fallback/filtering during selection.
3. Keep the SQLDelight column temporarily if it minimizes migration risk, but mark it legacy and stop using it in OIR behavior.
4. Preserve `OIRQuestionValidator` and `OIRTestQuestionSetValidator` as the validity/count SSOT.
5. Update repository fakes and test fixtures.

## Security checks

- Confirm a caller cannot request an invalid or partial local cache and bypass eligibility.
- Confirm selection remains bounded to authenticated, synchronized content.
- Confirm invalid legacy records never reach an active session.

## Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest --tests "*OIRQuestionSelectorTest"
./gradlew :data-firebase:testDebugUnitTest --tests "*OIRQuestionCacheManagerTest"
./gradlew :shared:testDebugUnitTest --tests "*OIRTestQuestionSetValidatorTest"
./gradlew check
```

---

# Phase 4 — Content ingestion and metadata tooling

**Goal:** New OIR content no longer receives an invented hardcoded difficulty label, and health checks reflect the new contract.

## Scope

- Remove hardcoded `difficulty = "MEDIUM"` from both OIR extraction scripts.
- Update upload validation so difficulty is not required for OIR correctness.
- Update content-health checks to report but not require legacy difficulty fields.
- Keep exact batch IDs, total questions, stable IDs, valid coverage, HTTPS images, and duplicate checks.
- Update metadata publisher to remove obsolete difficulty-level ownership from future writes while preserving unrelated legacy fields during migration.
- Do not rewrite production question documents in this phase without explicit approval.

## TDD/tests first

Add/update script or fixture tests for:

- Extracted question without difficulty passes the structural ingestion gate.
- Extracted question with legacy difficulty remains readable.
- Missing ID/text/options/correct answer still fails closed.
- Content health passes when difficulty is absent.
- Content health still reports malformed question records.
- Metadata dry-run has no write side effects.
- Metadata publisher rejects version downgrades.
- Production writes remain explicit and auditable.

## Implementation

1. Update extraction output schema.
2. Update upload gate and documentation.
3. Update `check-oir-content-health.js` output to include difficulty as informational only during migration.
4. Update scripts README and architecture documentation.
5. If approved separately, perform only a reviewed metadata cleanup; do not mass-edit 1,255 production questions without an authoritative difficulty source.

## Security checks

- Run script dependency audit.
- Confirm no credentials or generated content are staged.
- Confirm production command defaults to dry run/read-only behavior.
- Confirm no content write occurs during tests.

## Phase gate

```bash
python3 -m py_compile scripts/oir-extraction/oir_extract_v2.py scripts/oir-extraction/oir_extract_part3.py
node --check scripts/oir-extraction/upload-oir-batch.js
node --check scripts/check-oir-content-health.js
node scripts/check-oir-content-health.js
./gradlew check
```

Use the correct Python command (`python3 -m py_compile`) for Python scripts; do not treat a JavaScript command as a Python validator.

**Phase 4 completion evidence:** Both extractors omit difficulty from new records; the upload gate accepts absent and legacy difficulty; health checks report legacy difficulty informationally without requiring it; metadata publishers default to dry-run and do not own difficulty fields; fixture tests cover absent/legacy difficulty, malformed required content, and dry-run no-write behavior. No production content was written.

---

# Phase 5 — Result UI and user journey

**Goal:** The result screen accurately presents difficulty-free scoring and preserves all approved actions.

## Scope

- Remove the Difficulty Breakdown card and related strings from the active OIR result screen.
- Keep category performance cards, excluding categories with `0` questions.
- Keep Quick Stats: correct, incorrect, skipped, time taken, raw score.
- Keep `Review Answers`, `Take Another Test`, and `Back to Home`.
- Keep `Take Another Test` routed to the normal gated OIR start flow.
- Ensure `Review Answers` uses the existing submission ID and does not create a new attempt.
- Keep status indicator non-clickable unless it receives a real action.
- Use Material theme colors and correct accessibility semantics.

## TDD/UI tests first

Add/update tests for:

- Difficulty Breakdown is not rendered for a new OIR result.
- Legacy results with difficulty data do not resurrect the card.
- Spatial `0/0` category is not rendered.
- Review Answers navigates with the current submission ID.
- Take Another Test starts a new gated OIR attempt.
- A quota-exhausted user is blocked from Take Another Test.
- Back to Home invokes the fresh-dashboard navigation path.
- Result buttons have stable text/resources.
- Status indicator is not exposed as a clickable control.
- Light/dark theme colors remain readable.

## Implementation

1. Remove difficulty UI and unused resources.
2. Rename `Retake Test` to `Take Another Test` throughout shared navigation/UI.
3. Remove hardcoded OIR result colors.
4. Add/adjust Compose UI tests where the existing test infrastructure supports them.
5. Validate Android and iOS shared UI behavior through the common implementation.

## Security checks

- Confirm Take Another Test always reaches eligibility before session creation.
- Confirm Review Answers cannot mutate the submitted result.
- Confirm navigation passes only submission IDs/test IDs.
- Confirm no raw exception, token, or user identity is displayed.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest --tests "*OIRResult*"
./gradlew :shared:testDebugUnitTest --tests "*OIRTestViewModelTest"
./gradlew :shared:compileDebugKotlinAndroid
./gradlew check
```

**Phase 5 completion evidence:** The active OIR result flow no longer renders or references difficulty breakdown UI or its OIR-specific strings. Category cards remain filtered to positive question counts, quick stats and all three result actions remain present, and the result route passes the existing submission ID to answer review. “Take Another Test” enters the existing `OIRTestScreen` route, whose ViewModel performs the fail-closed OIR eligibility check before creating a session. Status remains a non-clickable themed surface. Android and iOS shared code compile and the full `check` gate passes; no Phase 5 tech debt remains.

---

# Phase 6 — Cross-platform, security, and release validation

**Goal:** Prove the difficulty-free OIR experience works consistently on Android and iOS and introduces no security or regression debt.

## Scope

- Run shared JVM and iOS tests.
- Run data-firebase Android tests and Firestore rules tests.
- Verify Koin composition on Android and iOS.
- Verify result fallback, retry, dashboard refresh, and answer review.
- Run content health after any approved production metadata change.
- Update the parent architecture document and this plan with final behavior.
- Record any remaining content limitation: difficulty is intentionally absent, while 186 invalid records remain skipped.

## Cross-phase matrix

| Area | Required evidence |
|---|---|
| Selection | Exact 50 questions and 20/20/10 distribution |
| Validity | Invalid records never reach a session |
| Scoring | Raw score equals correct answers; percentage is transparent |
| Eligibility | FREE/PRO/PREMIUM limits remain fail-closed |
| Session | Active, abandoned, expired, submitted transitions remain intact |
| Submission | Durable persistence and idempotent retry remain intact |
| Result | New and legacy result documents load safely |
| Review | Full answer data remains available |
| Dashboard | New result appears after returning Home |
| Security | Rules and ownership tests pass |
| Content | 28 batches, 1,255 records, valid/skipped counts, 529 images |
| UI | No active OIR difficulty UI, no zero-question cards, actions work |
| KMP | Android and iOS use the same shared behavior |

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:iosSimulatorArm64Test
./gradlew :data-firebase:testDebugUnitTest
./gradlew :lint:test
./gradlew check
node scripts/check-oir-content-health.js
```

Complete manual smoke tests:

1. Eligible FREE/PRO/PREMIUM user starts and submits OIR.
2. User at quota limit taps `Take Another Test` and is blocked.
3. User opens `Review Answers` after submission.
4. User returns Home and sees the new result without manual refresh.
5. Network interruption during eligibility, cache preparation, result loading, and submission produces retryable behavior.
6. Android and iOS show the same result data and action behavior.

---

## Phase 6 completion evidence

Automated Phase 6 validation completed on 2026-08-07:

- `./gradlew :shared:testDebugUnitTest` — passed.
- `./gradlew :shared:iosSimulatorArm64Test` — passed on the iOS simulator target.
- `./gradlew :data-firebase:testDebugUnitTest` — passed.
- `./gradlew :lint:test` — passed.
- `./gradlew check` — passed. The build reports existing lint/compiler warnings, but no errors; diagnostics report no errors or warnings in the project.
- `node scripts/test-oir-tooling.js` — passed with no Firebase writes.
- `node scripts/check-oir-content-health.js` — passed read-only: 28 batches, 1,255 records, 1,069 valid, 186 skipped, 529 verified HTTPS image URLs, and 1,255 informational legacy difficulty fields.
- Firestore rules validation is included in the Android unit-test suite and passed as part of the project gates.
- Shared KMP code is the common Android/iOS implementation; no platform-specific OIR result or selection fork was found.

The final cross-phase check confirms that the product contract is implemented: difficulty does not participate in selection, scoring, persistence of new results, result presentation, or navigation; legacy question/result fields remain tolerant read-only compatibility data; validity and 20/20/10 selection remain enforced; eligibility, durable sessions, idempotent usage, result fallback, answer review, dashboard invalidation, and retry states remain in their existing shared flows. No production Firestore writes were performed.

Intentional remaining limitation: difficulty is absent from new OIR behavior, while 186 invalid production records remain in Firestore for auditability and are skipped at selection time. Manual device smoke tests (eligible tiers, quota exhaustion, network interruption, Android/iOS visual parity) were not executable in this workspace and remain the only unverified release evidence.

Tech-debt sweep: removed stale Phase 2 migration wording from the OIR DTO documentation. No OIR-specific tech debt was introduced. The scripts dependency audit still reports eight moderate transitive `uuid` advisories; resolving them requires the breaking `firebase-admin@14` upgrade and is deliberately not included in this feature commit.

## 4. Final handoff checklist

Before marking this initiative complete:

- [x] All six phase handoffs provided.
- [x] All phase builds passed.
- [x] All targeted and full tests passed.
- [x] No file exceeds 300 lines of source code in the changed OIR scope.
- [x] No unexplained diagnostics remain in changed files.
- [x] No hardcoded OIR result strings/colors remain.
- [x] No active OIR code requires question difficulty.
- [x] Legacy result documents remain readable.
- [x] New results use transparent correct-answer scoring.
- [x] Question validity and 20/20/10 distribution remain enforced.
- [x] FREE/PRO/PREMIUM gates remain enforced for new attempts.
- [x] Firestore rules/security tests pass.
- [x] Production content-health verification passes.
- [ ] Manual network and first-time journey smoke tests pass (not executable in this workspace).
- [x] Parent architecture documentation is updated.
- [x] Tech debt incurred by this initiative is resolved; the transitive dependency advisory is recorded as a separate breaking-upgrade task.
- [x] Commit is created only after the automated final gate is green.
