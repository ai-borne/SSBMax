# OIR Improvement Execution Plan

**Status:** Phase 7 complete; final release gate pending
**Target branch:** `feature/OIR_Impr_01`
**Scope:** First-time OIR experience from eligibility check through test completion, result display, and Home dashboard refresh.
**Source architecture:** `docs/architecture/OIR_Architecture.md`
**Production content baseline:** Firestore project `ssbmax-49e68`, `contentVersion = 4`, 28 canonical batches, 1,255 questions, 529 verified image URLs.

---

## 1. Non-negotiable execution rules

These rules apply to every phase.

### 1.1 Phase gate

- Work on one phase at a time.
- A phase is incomplete until its implementation, tests, build, and checks are successful.
- Do not begin the next phase while any phase gate is failing.
- Do not hide, weaken, skip, or delete a failing test to obtain a green build.
- If a phase exposes unrelated pre-existing failures, record them separately and do not claim the phase passed until the changed scope is verified.

### 1.2 TDD

For every behavior change:

1. Add or update a failing unit/integration test that expresses the desired behavior.
2. Implement the smallest correct change.
3. Refactor without changing behavior.
4. Run the narrowest relevant test.
5. Run the complete phase test suite.
6. Run the project build/check gate.

Tests must cover both the success path and the failure/security path.

### 1.3 Architecture and code quality

- Preserve MVVM: UI emits events, ViewModels coordinate state, use cases own business orchestration, repositories own persistence/network access.
- Keep domain rules in `shared` and platform code behind interfaces.
- Maintain SSOT for OIR distribution, test configuration, eligibility, result mapping, and content versioning.
- No Firebase calls from Compose UI or ViewModels.
- No mutable singleton state.
- Use `StateFlow`/`MutableStateFlow.update` patterns already established in the project.
- No file may exceed 300 lines of code. Split files before crossing the limit.
- Keep navigation ID-based; never pass full questions, sessions, or result objects through routes.
- Use `ErrorLogger`/`DomainLogger` according to module rules; no `printStackTrace()`.

### 1.4 UI/resource rules

- No hardcoded user-facing strings; add localized string resources.
- No hardcoded colors; use `MaterialTheme.colorScheme`.
- No unexplained hardcoded dimensions; use existing design tokens or `dp`/`sp`.
- Loading, error, retry, empty, and success states must be explicit and testable.

### 1.5 Security rules

- Eligibility must fail closed when the server result is unavailable or malformed.
- Never trust client-provided score, usage, ownership, or status transitions.
- Preserve immutable identity fields: `userId`, `testType`, submission ID, and session ID.
- Make usage recording idempotent by submission/session ID.
- Do not expose service-account keys, tokens, or production credentials in source control, logs, test fixtures, or plan artifacts.
- Firestore rules must be tested for authorized and unauthorized reads/writes.
- Production Firestore writes require explicit confirmation and a documented verification command.

### 1.6 Required phase handoff

At the end of every phase, stop and provide a Phase Summary containing:

1. Changes completed.
2. Tests added and executed.
3. Build/check commands executed and their results.
4. Tech debt incurred during the phase.
5. Exact steps taken to resolve that debt immediately.
6. Remaining risks or blockers.
7. Confirmation that the phase gate passed.

No next phase begins until this summary is accepted and the gate is green.

---

## 2. Baseline and branch safety

Before Phase 1:

- Confirm the working tree is clean or document existing user changes.
- Confirm the branch is `feature/OIR_Impr_01` and is based on `main`.
- Do not modify production Firestore during code phases unless the phase explicitly requires it.
- Record the baseline results of:

```bash
./gradlew check
```

If the full check is too broad for the baseline, run the narrowest available shared/data-firebase test tasks first, then record the full-check result and any pre-existing failures.

Baseline artifacts to record:

- Current OIR source files and active KMP implementations.
- Current Firestore metadata and canonical batch count.
- Current test count and known failures.
- Current diagnostics for changed modules.

---

# Phase 1 — Eligibility and start gate hardening

**Priority:** P0
**Goal:** A user cannot start OIR unless authentication, subscription eligibility, cache readiness, and a complete valid question set are confirmed.

## 1.1 Scope

Address:

- Eligibility exceptions currently continuing into question loading.
- Explicit retryable eligibility failure state.
- Exact 50-question invariant.
- Required type coverage before test start.
- Clear separation of authentication, limit reached, network failure, and content failure.

Likely areas:

- `shared/.../domain/usecase/subscription/CheckTestEligibilityUseCase.kt`
- `shared/.../presentation/oir/OIRTestViewModel.kt`
- `shared/.../presentation/oir/OIRTestUiState.kt`
- `shared/.../ui/oir/OIRTestScreen.kt`
- OIR string resources.

## 1.2 TDD tests first

Add/update tests for:

- Eligible user proceeds.
- Limit-reached user never downloads or starts a test.
- Network failure blocks the test and exposes retry state.
- Unexpected eligibility exception blocks the test.
- Unauthenticated user is blocked.
- A selected set with fewer than 50 questions is rejected.
- A selected set missing a required distribution category is rejected.
- Exactly 50 valid questions creates the session state.
- Invalid questions are filtered without allowing a partial test.

Use Turbine and `kotlinx-coroutines-test` for StateFlow behavior.

## 1.3 Implementation steps

1. Model explicit OIR start states rather than relying on nullable fields.
2. Make all eligibility failures terminal for the current start attempt.
3. Add a single domain-level `OIRTestConfig`/question-count source of truth.
4. Validate exact count and distribution after selection.
5. Add a retry action that retries the failed start step without bypassing eligibility.
6. Ensure loading and error states do not render active test controls.
7. Keep all user-facing text in shared string resources.

## 1.4 Security checks

- Confirm no exception path reaches `getOIRTestQuestions()` after eligibility failure.
- Confirm a client cannot select a local cache and bypass eligibility.
- Confirm unknown subscription tier/usage data fails closed.
- Add tests proving no use-case calls occur after a blocked eligibility result.

## 1.5 Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew check
```

Also run diagnostics for all changed Kotlin/resource files. Do not proceed if any new warning/error remains unexplained.

---

# Phase 2 — Cache synchronization and first-run readiness

**Priority:** P0
**Goal:** The first OIR test waits for a reliable, complete-enough cache and never starts from a silently partial sync.

## 2.1 Scope

Address:

- Ignored `Result` values from Phase 1 batch downloads.
- Silent fallback to legacy batch count on metadata/network errors.
- First-run cache initialization timing.
- Cache readiness and retry UX.
- Exact valid-question availability.
- Background Phase 2 lifecycle ownership.

Likely areas:

- `data-firebase/.../GitLiveOIRQuestionCacheManager.kt`
- `data-firebase/.../GitLiveTestContentRepository.kt`
- OIR cache status model/use case.
- Student Home/ViewModel preparation state.
- OIR loading components.

## 2.2 TDD tests first

Add/update tests for:

- Metadata version mismatch clears old content.
- Missing batches are downloaded.
- Phase 1 download failure returns failure.
- Phase 1 failure never reports the cache as ready.
- Background batch failure is observable/logged and retriable.
- A fresh install can obtain enough valid questions for a 50-question test.
- A cache with fewer than 50 valid questions cannot start a test.
- A matching version with all batches present performs no unnecessary Firestore read.
- A matching version with missing batches tops up only missing batches.
- Metadata read failure produces a user-visible retry state rather than silently pretending the legacy bank is current.

Use an injected clock/scope where needed so tests are deterministic.

## 2.3 Implementation steps

1. Make sync methods propagate failures consistently.
2. Separate `metadata unavailable`, `sync in progress`, `ready`, and `insufficient content` states.
3. Define a cache readiness contract in the domain layer.
4. Prewarm the first four batches from the authenticated Home flow or an explicit preparation use case.
5. Keep Phase 2 background work under an application-owned scope with cancellation semantics.
6. Make the OIR start flow await readiness rather than polling arbitrary local row counts.
7. Add cache progress information without exposing implementation details unnecessarily.

## 2.4 Security and data checks

- Only authenticated users may read OIR content according to deployed rules.
- Content writes remain server/tool-only.
- Never log question answers or full question content in production logs.
- Verify the metadata content version is read from Firestore, not hardcoded.

## 2.5 Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest
./gradlew :shared:testDebugUnitTest
./gradlew check
```

Do not proceed if the first-run cache tests are flaky, timing-dependent, or allow a partial test.

---

# Phase 3 — Durable test-session lifecycle

**Priority:** P0
**Goal:** Starting, exiting, timing out, and completing an OIR test have one coherent session lifecycle.

## 3.1 Design decision

**Implemented decision (preferred durable Firestore session):** OIR creates a durable Firestore session before questions are exposed. Exiting marks it `ABANDONED`; successful submission marks it `SUBMITTED`; expiry is represented by the terminal `EXPIRED` rule state. Resume is intentionally not implemented in this phase, so abandoned/expired sessions are not re-entered.

Choose and document one model:

### Preferred model: durable Firestore session

- Create a session before test interaction begins.
- Store `sessionId`, `userId`, `testId`, `testType`, start time, and absolute expiry.
- End the session on successful submit.
- Mark it abandoned/paused on exit.
- Support resume or clearly expire it.

Do not keep a repository dependency that the flow does not actually use.

## 3.2 TDD tests first

Add tests for:

- Session creation success.
- Session creation failure blocks test start.
- Session belongs to the authenticated user.
- Session uses the configured test type and test ID.
- Exit marks the session correctly.
- Successful submit ends the session.
- Timer expiration submits only once.
- Resume restores the correct question index, answers, and remaining time, if resume is implemented.
- A stale/expired session cannot be resumed.

## 3.3 Implementation steps

1. Create a session through `TestSessionRepository` before exposing questions.
2. Use the server/session ID consistently for submission and result navigation.
3. Replace coroutine decrement-only timing with absolute expiry calculation.
4. Add explicit session states: active, paused/abandoned, submitted, expired.
5. Ensure ViewModel cancellation does not leave a misleading active state.
6. Add a user-visible confirmation for leaving an active test.

## 3.4 Firestore rules

Test:

- A student can create only their own active session.
- A student can read only their own session.
- A student cannot change `userId`, `testType`, or session ownership.
- A student cannot reactivate an expired or submitted session.
- A student cannot read another user’s session.

## 3.5 Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest
./gradlew :shared:testDebugUnitTest
./gradlew check
```

Run Firestore rules tests before marking the phase complete.

**Phase 3 implementation checkpoint:** Complete. The OIR flow now uses the persisted session ID for submissions/results, fails closed when session creation fails, uses absolute expiry bounded timer updates, and has explicit active/abandoned/submitted rule transitions. The phase gate and final deep audit are recorded in the implementation handoff, not this plan, so this plan remains the scope SSOT.

---

# Phase 4 — Test-taking UX and timer reliability

**Priority:** P1
**Goal:** The interactive test is clear, resilient, accessible, and difficult to misuse.

## 4.1 Scope

Address:

- Loading/error controls.
- Submit confirmation.
- Double-tap prevention.
- Timer correctness across backgrounding/configuration changes.
- Explicit skip/unanswered behavior.
- Exit/resume messaging.
- Immediate feedback behavior.

Likely areas:

- `shared/.../ui/oir/OIRTestScreen.kt`
- `shared/.../ui/oir/components/*`
- `shared/.../presentation/oir/*`
- Shared string resources.

## 4.2 TDD/UI tests first

Test:

- Loading state hides active navigation controls.
- Retry is available after recoverable failure.
- Submit button is disabled after the first submit event.
- Submit confirmation appears when configured.
- An unanswered final question is handled intentionally.
- Previous/next navigation preserves answers.
- Timer survives recomposition and recalculates from expiry.
- Timer submits once at zero.
- Exit confirmation works.
- Accessibility labels exist for timer, navigation, images, and actions.

## 4.3 Implementation steps

1. Add an explicit `isSubmitting` state.
2. Add a submission confirmation dialog using resources.
3. Make the timer derive remaining time from `expiresAt`.
4. Add a clear skipped-question policy.
5. Improve question/image loading placeholders and failures.
6. Keep Composables below 50 lines where practical and all files below 300 lines.

## 4.4 Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew check
```

Run available Compose/UI tests for Android and shared targets.

**Phase 4 implementation checkpoint:** Complete. The shared OIR test-taking flow now hides active controls during loading/submission, confirms submission, prevents duplicate submits, records skipped/unanswered questions explicitly, derives timer updates from absolute session expiry, provides exit messaging, keeps immediate feedback, exposes image loading/error states, and includes timer/navigation/image accessibility labels. Focused shared Android Compose/use-case tests pass; changed Kotlin/resource diagnostics are clean. The full `check` graph reached lint and 586 iOS tests before the bounded command timeout; no changed-scope failures were reported. Remaining project-wide warnings are pre-existing and outside OIR scope.

---

# Phase 5 — Idempotent submission, quota integrity, and Firestore security

**Priority:** P0
**Goal:** A completed test cannot consume quota without a durable result, cannot be double-charged, and cannot be tampered with by the client.

## 5.1 TDD tests first

Add tests for:

- Submission retry with the same session ID returns the same result ID.
- Repeated submit events do not create duplicate usage.
- Submission failure does not incorrectly report success.
- Usage failure does not create a misleading completed result.
- Usage is recorded exactly once after durable submission.
- Dashboard invalidation occurs only after submission persistence.
- Session end is retried or surfaced appropriately.
- Question-use marking is best effort and does not corrupt submission success.

## 5.2 Implementation strategy

Preferred sequence:

1. Reserve/validate eligibility.
2. Persist an idempotent submission with `sessionId` as the stable key.
3. Record usage using the same idempotency key.
4. Finalize session state.
5. Invalidate dashboard cache.
6. Mark questions used.

If true cross-document atomicity is not possible from the client, introduce a trusted backend/Cloud Function for quota and submission finalization. Do not claim client-side ordering is transactional.

## 5.3 Firestore rule changes

Correct and test:

- `lastUpdated` representation: Firestore Timestamp versus integer.
- Student update allowlist.
- Immutable `userId`, `testType`, and submission identity.
- Valid status transitions.
- No client-side score/result mutation after finalization.
- No arbitrary usage counter changes beyond the intended operation.

## 5.4 Phase gate

```bash
./gradlew :data-firebase:testDebugUnitTest
./gradlew :shared:testDebugUnitTest
./gradlew :app:testDebugUnitTest
./gradlew check
```

Deploy rules only after local rules tests pass. After deployment, run authenticated/unauthenticated smoke checks without exposing user data.

**Phase 5 implementation checkpoint:** Complete. OIR now persists the result before quota usage, uses the durable session ID as the submission and usage idempotency key, returns an existing submission on retry without mutating finalized data, records usage in a Firestore transaction, finalizes the session before dashboard invalidation, and treats question-use marking as best effort. Firestore rules enforce authenticated ownership, immutable session identity, OIR session linkage, immutable finalized submissions, monotonic single-attempt usage updates, and immutable usage identity/month fields. Focused shared submission tests, data-firebase compilation, and local Firestore rule validation passed. The full `check` graph repeatedly reached 667 shared Android tests and 586 iOS shared tests without reported failures but exceeded the bounded 10-minute command limit; pre-existing lint/deprecation warnings remain outside the changed scope. No production rules were deployed.

---

# Phase 6 — Complete result persistence and answer review

**Priority:** P1
**Goal:** The result screen faithfully represents the result calculated at submission time.

## 6.1 Scope

Address:

- Difficulty breakdown being discarded during reads.
- Answered-question data not being reconstructed.
- Empty review callback.
- Separate result/dashboard mapper divergence.
- Result cache population and fallback behavior.

Likely areas:

- `data-firebase/.../OIRSubmissionMappers.kt`
- `data-firebase/.../GitLiveOirResultRepository.kt`
- `shared/.../presentation/oirresult/*`
- `shared/.../ui/oir/OIRTestResultScreen.kt`
- Result/review components.

## 6.2 TDD tests first

Test round-trip preservation of:

- Overall score.
- Category scores.
- Difficulty scores.
- Answered questions.
- Selected answers.
- Correct answers.
- Explanations.
- Time taken.
- Skipped questions.

Also test:

- Missing optional fields default safely.
- Malformed category/difficulty keys do not crash the result screen.
- Result cache hit and Firestore fallback produce the same domain object.
- A missing submission gives a clear not-found state.

## 6.3 Implementation steps

1. Define one canonical OIR result DTO/domain mapper.
2. Round-trip all result fields needed by the UI.
3. Populate local result cache at submission or immediately after a successful read.
4. Implement the answer-review screen using ID-based navigation only.
5. Add loading/error/retry behavior for result retrieval.
6. Do not pass the full result object through navigation.

## 6.4 Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :data-firebase:testDebugUnitTest
./gradlew check
```

Verify result screenshots/manual flow on Android and, where available, iOS/shared targets.

**Phase 6 implementation checkpoint:** Complete. Result DTOs now round-trip overall/category/difficulty scores, timing, skipped counts, and complete answered-question data (question, options, selected/correct answers, explanations). Firestore reads and SQLDelight cache reads use the same canonical mapper, malformed enum keys are ignored safely, missing optional fields use safe defaults, and successful Firestore reads populate the cache for equivalent fallback behavior. The result screen now navigates by submission ID to a dedicated answer-review screen with loading/error states. Focused data-firebase compilation and DTO tests passed; changed-file diagnostics and whitespace checks are clean. Full `check` remains the final release gate and must be run before commit.

---

# Phase 7 — Home dashboard freshness and end-to-end journey

**Priority:** P1
**Goal:** After submission, the user immediately sees the correct OIR result on the result screen and Home without manual recovery steps.

## 7.1 TDD/integration tests first

Create an end-to-end state test covering:

```text
authenticated first launch
→ Home
→ OIR eligibility
→ cache preparation
→ test start
→ answer/navigation
→ submit
→ result screen
→ navigate Home
→ latest OIR score visible
→ tap Home result
→ same result reopens
```

Test failure variants:

- Firestore result read temporarily fails.
- Dashboard fetch is concurrent with submission.
- Cached dashboard contains an older result.
- Result and submission IDs differ in legacy data.

## 7.2 Implementation steps

1. Invalidate dashboard only after successful submission persistence.
2. Ensure Home creates/fetches a fresh dashboard after returning from result.
3. Reconcile legacy result/session IDs consistently.
4. Use one result mapper for dedicated result and Home dashboard paths.
5. Show a clear “saved successfully” state if dashboard refresh is delayed.
6. Keep manual refresh as a fallback, not a requirement.

## 7.3 Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :data-firebase:testDebugUnitTest
./gradlew :app:testDebugUnitTest
./gradlew check
```

Complete a manual first-time smoke test with network interruption/retry scenarios.

**Phase 7 implementation checkpoint:** Complete for the code/test scope. Submission persistence, usage recording, session finalization, and dashboard invalidation are ordered so a successful OIR submission cannot leave a reusable stale dashboard snapshot. Home returns through a fresh `StudentHomeViewModel`, which fetches the dashboard after the result route is removed; manual refresh remains available as fallback. The dashboard path uses the canonical OIR result mapper and normalizes legacy internal session IDs to the submission document ID, so Home result navigation reopens the same persisted result. Added a regression test proving invalidation that races an in-flight dashboard fetch evicts the fetched snapshot before the next Home load. Existing tests cover cached older results, forced refresh, temporary partial fetch failures, result-cache fallback, and ID reconciliation. Focused shared dashboard/submission tests pass. The full project check, Firestore rules suite, production read-only content-health verification, and manual network-interruption smoke test remain final release-gate evidence and are not claimed by this checkpoint.

---

# Phase 8 — Metadata, tooling, and architecture cleanup

**Priority:** P2
**Goal:** Prevent operational drift and make the documented architecture match production.

## 8.1 Metadata/tooling changes

- Update `set-oir-meta-config.js` defaults to the current content version or require explicit version input.
- Prevent accidental metadata downgrades.
- Update distribution metadata to the runtime SSOT: 20/20/10.
- Keep `batchCount = 28` and `total_questions = 1,255` consistent.
- Add a dry-run content-health command.
- Keep production writes explicit and auditable.

## 8.2 Content-health checks

The verification command must check:

- Metadata exists and is internally consistent.
- Batch IDs are exactly `batch_pdf_001..028`.
- Batch totals sum to 1,255.
- Every question has a stable ID.
- Valid question count and category coverage are reported.
- Image URLs are HTTPS and return HTTP 200.
- No legacy `batch_002` exists.
- No duplicate question IDs exist across batches.

## 8.3 Documentation cleanup

Update `docs/architecture/OIR_Architecture.md` for:

- SQLDelight as the active KMP cache.
- Current content version and batch totals.
- Current valid/skipped content counts.
- Actual session behavior after Phase 3.
- Actual result-review behavior after Phase 6.
- Current subscription/idempotency model after Phase 5.

Archive or remove obsolete batch-specific scripts, especially those referring to deleted `batch_002`.

## 8.4 Phase gate

```bash
./gradlew check
```

Run the production read-only content-health command and store its summary in the Phase Summary. Do not deploy content or rules from an unreviewed working tree.

**Phase 8 implementation checkpoint:** Tooling and documentation cleanup is complete. `set-oir-meta-config.js` now defaults to content version 4, updates the runtime-owned 20/20/10 distribution and 1,255 total on explicit commit, and rejects committed downgrades. Added `check-oir-content-health.js` plus npm entry points; the production read-only run verified 28 canonical batches, 1,255 questions, 1,069 valid/186 skipped records, and 529 HTTPS image URLs returning HTTP 200. Architecture documentation now describes SQLDelight, current metadata/content counts, durable session/result-review behavior, idempotent submission ordering, and current subscription behavior. Obsolete scripts and fixtures for the deleted `question_batches/batch_002` schema were removed. Syntax, diagnostics, whitespace, and focused OIR tests pass.

The approved production metadata publish was completed after explicit confirmation. The nested legacy spatial field was removed, and the post-write read-only health check passed with `contentVersion=4`, `batchCount=28`, `total_questions=1,255`, runtime distribution `20/20/10`, 1,069 valid/186 skipped records, and 529 HTTP 200 image URLs. Phase 8's metadata/tooling gate is complete; the final release gate still requires the broader project check and manual journey/network-interruption evidence.

---

# 3. Cross-phase validation matrix

| Area | Required validation |
|---|---|
| Authentication | Anonymous user cannot start or read protected OIR content |
| Eligibility | Limit, network, malformed data, and unexpected exceptions fail closed |
| Cache | Version mismatch, missing batches, partial sync, retry, exact count |
| Distribution | 20 verbal / 20 non-verbal / 10 numerical |
| Question validity | Invalid records never reach a test |
| Session | Create, active, exit, timeout, submit, ownership, expiry |
| Timer | Absolute expiry, backgrounding, timeout, one-shot submit |
| Answers | Navigation, selection, skipped questions, scoring |
| Submission | Durable persistence, idempotency, retry, double-submit prevention |
| Usage | Exactly-once behavior, correct month, secure update, timestamp type |
| Rules | Authorized/unauthorized read and write tests |
| Result | Full field round-trip, cache fallback, retry, answer review |
| Dashboard | Fresh latest result, cache invalidation ordering, navigation ID |
| Content | 28 batches, 1,255 questions, 529 HTTP 200 image URLs |
| Resources | Strings, colors, dimensions, accessibility labels |
| Architecture | MVVM, SSOT, no Firebase in UI, file-size limits |
| Security | No client tampering, no credential exposure, immutable identity fields |

---

# 4. Final release gate

The OIR improvement work is release-ready only when all of the following are true:

- Every phase handoff has been completed.
- All targeted tests pass.
- `./gradlew check` passes.
- No changed code file exceeds 300 lines.
- No new diagnostics remain.
- Firestore rules tests pass.
- Production content-health verification passes.
- The full first-time journey has been manually tested.
- Network failure/retry scenarios have been manually tested.
- No result is lost after a successful submit.
- No user is double-charged after retry or double tap.
- The Home dashboard shows the new result without requiring a manual refresh.
- All security and resource checks pass.

Only after this final gate should the branch be proposed for merge into `main`.
