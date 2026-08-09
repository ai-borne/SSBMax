# OIR Architecture

Covers both the **content pipeline** (PDF → Firestore) and the **serving layer** (SQLDelight cache → user test).

## At a Glance

OIR is a 50-question, timed test. A student starts from the shared Compose/KMP test route, passes authentication, subscription, cache-readiness, and question-set gates, then receives a freshly sampled set with this fixed distribution:

```text
20 verbal reasoning + 20 non-verbal reasoning + 10 numerical ability = 50 questions
```

Firestore is the source of truth for content, sessions, submissions, and monthly usage. SQLDelight is the local question cache. `shared` owns the domain, ViewModels, UI, and navigation; `data-firebase` owns the GitLive/Firebase implementations for both Android and iOS.

### End-to-End Student Journey

```text
Student Home
  → OIR test route (`test/oir/{testId}`)
  → authentication and monthly eligibility gate
  → metadata/cache readiness gate
  → valid 50-question set gate
  → durable session creation
  → timed question interaction
  → submit confirmation and one-shot submission
  → durable result persistence
  → idempotent usage recording
  → session finalization and dashboard invalidation
  → result route (`test/oir/result/{submissionId}`)
  → answer review (`test/oir/review/{submissionId}`)
  → fresh Home dashboard
```

The result and answer-review routes pass only the durable submission ID. They fetch result data through their own ViewModels; full questions, sessions, and result objects are never passed through navigation.

### Implementation Map

| Responsibility | Implementation |
|---|---|
| Navigation and routes | `shared/src/commonMain/kotlin/com/ssbmax/navigation/SSBMaxDestinations.kt`, `PsychTestsGraph.kt` |
| Test UI | `shared/.../ui/oir/OIRTestScreen.kt` and `ui/oir/components/` |
| Test state/orchestration | `shared/.../presentation/oir/OIRTestViewModel.kt` |
| Eligibility | `shared/.../domain/usecase/subscription/CheckTestEligibilityUseCase.kt` |
| Question-set contract | `shared/.../domain/validation/OIRTestQuestionSetValidator.kt` |
| Question validity | `shared/.../domain/validation/OIRQuestionValidator.kt` |
| Cache and sync | `data-firebase/.../GitLiveOIRQuestionCacheManager.kt` |
| Selection/distribution | `data-firebase/.../GitLiveOIRQuestionSelector.kt` and `shared/.../OIRQuestionDistribution.kt` |
| Durable sessions | `data-firebase/.../GitLiveTestSessionRepository.kt` |
| Scoring/submission orchestration | `shared/.../domain/usecase/oir/SubmitOIRTestUseCase.kt` |
| Firestore result/cache mapping | `shared/.../OIRSubmissionMappers.kt`, `data-firebase/.../GitLiveOirResultRepository.kt` |
| Result and answer review | `shared/.../ui/oir/OIRTestResultScreen.kt`, `OIRAnswerReviewScreen.kt` |
| Home refresh | `shared/.../presentation/home/student/StudentHomeViewModel.kt` and `GetOLQDashboardUseCase.kt` |
| Firestore/Koin implementations | `data-firebase/.../di/RepositoryModule.kt` |

---

## Content Pipeline (PDF → Firestore)

### Design Principle
Keep the LLM out of the correctness path. `questionText`, `correctAnswerId`, and `explanation` are extracted deterministically from the PDF text layer. OIR extraction emits no difficulty label; legacy difficulty fields are tolerated only for backward-compatible reads and are informational in health checks.

### Scripts
| Script | Role |
|---|---|
| `scripts/oir-extraction/oir_extract_v2.py` | Extract the 20 practice-set batches (001–020) from the SSBCrack PDF |
| `scripts/oir-extraction/oir_extract_part3.py` | Extract the 8 topic-family batches (021–028) from `OIR PART 3`; reuses v2 helpers (`composite_figure`, `page_images`, `OPT_IDS`) |
| `scripts/oir-extraction/upload-oir-batch.js` | Ingestion **gate** + upload images → Storage, questions → Firestore |
| `scripts/set-oir-meta-config.js` | Publish `test_content/oir/meta/config` `{contentVersion, batchCount}` — dry-run by default and rejects committed downgrades |
| `scripts/check-oir-content-health.js` | Read-only production verification of metadata, all 28 batches, question IDs/types, totals, HTTPS image URLs, and informational legacy-difficulty counts |

The upload script's `validateBatch()` is a **fail-closed ingestion gate**: it mirrors the error-level rules of the domain `OIRQuestionValidator` (non-empty options, `correctAnswerId` present unless a figure question, answer ∈ option ids, non-blank text) and rejects the write if any question violates them. The Kotlin validator stays the SSOT for the *rules*; the gate enforces them at write time.

### Extraction Pipeline (oir_extract_v2.py)
1. **Page range mapping** — `SET_TABLE` hardcodes `(q_start, a_start, a_end)` for all 20 sets (no guessing)
2. **Stage 1 — Questions** — text layer, sequential marker validation (`^(\d{1,2})[.)]`) prevents false positives
3. **Stage 2 — Answers + Explanations** — text layer, `^(\d{1,2})\.[ \t]*Answer:` regex; inter-entry text = real human explanation
4. **Stage 3 — Figure crops** — `doc.extract_image(xref)` returns clean raster (watermark is text-layer only); images composited onto white canvas at 3× zoom
5. **Stage 4 — Answer mapping** — deterministic: `"(2)"` → `opt_b`, `"5"` → `opt_e`, Yes/No matched to options, multi-answers embedded in explanation
6. **Stage 5 — Type heuristic** — keyword + figure-presence classification; no AI
7. **Stage 6 — Output** — `out/batch_pdf_{NNN}.json` + `out/batch_pdf_{NNN}_preview.html` (human-review gate) + `out/images/set{N}_q{MM}.png`

`questionImageUrl` is written as `gs://BUCKET/...` placeholder, rewritten to public HTTPS at upload time.

### Upload (upload-oir-batch.js)
```
node upload-oir-batch.js batch_pdf_001            # live upload
node upload-oir-batch.js batch_pdf_001 --dry-run  # offline validation only
node upload-oir-batch.js batch_pdf_001 --verify   # HEAD-check all questionImageUrls in Firestore
node upload-oir-batch.js batch_pdf_001 --repair   # re-upload missing images + patch gs:// placeholders
```
1. Validates all local image files exist before touching Firebase
2. Uploads PNGs to `gs://ssbmax-49e68.firebasestorage.app/oir/pdf_questions/` (public)
3. Rewrites `questionImageUrl` placeholders to `https://storage.googleapis.com/...`
4. Writes Firestore doc at `test_content/oir/batches/{batchId}`

**Recommended post-upload step:** always run `--verify` after a live upload to confirm every `questionImageUrl` resolves with HTTP 200. If any are broken, `--repair` re-uploads only the missing Storage objects and patches the Firestore doc — no full re-upload needed.

### Upload Status
✅ **All 28 batches extracted, uploaded, and meta doc PUBLISHED (June 7, 2026)**
- Batches 001–020: 1,000 questions (SSBCrack original sets) + Batches 021–028: 255 questions (Part-3 topic families)
- Total: ~1,255 questions live in Firestore
- Images: All live at `gs://ssbmax.../oir/pdf_questions/` (public HTTPS); the health gate verified 529 unique URLs with HTTP 200.
- Content health baseline: 1,069 valid questions and 186 skipped legacy/invalid records; all three runtime categories have ample valid coverage.
- Meta doc: `test_content/oir/meta/config` is published as `{ contentVersion: 4, batchCount: 28, total_questions: 1255, distribution: 20/20/10 }`; metadata publishers do not own difficulty fields.
- Run `node scripts/check-oir-content-health.js` for the production read-only gate; it performs no writes and requires `FIREBASE_SERVICE_ACCOUNT` (or the local development key).

> **Skipped legacy/invalid records:** The production health check currently reports 186 records that
> fail the runtime validity contract (including the known optionless free-response records in batches
> 001–020). They remain in Firestore for auditability but are **skipped at selection-time** (see
> Serving Layer) so they never reach an assembled test.

---

## Serving Layer (App Runtime)

### Storage Layout & Organization

**Firestore** (28 canonical batch documents + 1 meta doc):
```
test_content/oir/batches/
├─ batch_pdf_001..020 (50 Qs each, source = SSBCrack Sets 1–20)
└─ batch_pdf_021..028 (255 Qs total, source = OIR PART 3 topic families)
test_content/oir/meta/config = { contentVersion: Int, batchCount: Int }
```
Each batch doc has `{"batchId", "version", "totalQuestions", "questions": [...]}`. The **meta doc** is
the content-version SSOT that drives client reconciliation (see below).

**Firebase Storage:** `oir/pdf_questions/set{N}_q{MM}.png` (public HTTPS URLs)

**SQLDelight (local cache):** All questions (~1,255 across 28 batches) are **flattened into ONE table** (`cached_oir_questions`):
```sql
cached_oir_questions (~1255 rows)
├─ oir_pdf_s01_q0001 | VERBAL_REASONING      | batchId='batch_pdf_001' | lastUsed=null
├─ oir_pdf_s01_q0002 | NON_VERBAL_REASONING  | batchId='batch_pdf_001' | lastUsed=null
├─ ...
├─ oir_pdf_s02_q0001 | VERBAL_REASONING      | batchId='batch_pdf_002' | lastUsed=2 days ago
├─ ...
└─ oir_pdf_s20_q0050 | SPATIAL_REASONING     | batchId='batch_pdf_020' | lastUsed=null
```
**Key:** The `batchId` column preserves which batch each question came from (for auditing/analytics), but **batches are NOT isolated** — all questions are pooled together.

### Content-Version Reconciliation (Firestore is SSOT, SQLDelight mirrors)
`GitLiveOIRQuestionCacheManager.initialSync()` reads `test_content/oir/meta/config` and compares
`remote.contentVersion` to the locally-stored value in SQLDelight's single-row
`oir_sync_metadata` table. SQLDelight is the active KMP cache on Android and iOS; the former Android-only Room path is no longer part of OIR serving:

| Condition | Action |
|---|---|
| `remote.contentVersion != local` (incl. fresh install where local = null) | **Reconcile** — clear all questions + re-download `batch_pdf_001..batchCount`, then persist the new version |
| version matches but some of `1..batchCount` missing | Top-up just the missing batches (idempotent) |
| version matches and all present | Skip (zero Firestore reads) |

So existing installs **self-heal** to new content on the next launch — bump `contentVersion` (and
`batchCount` when batches are added) via `set-oir-meta-config.js`; **no Kotlin change** is needed for
a future content drop. Metadata read failures are surfaced as a retryable cache state; the client no
longer silently treats an unreadable metadata document as a current legacy 20-batch bank.

> ✅ **Release gate status:**
> - Firestore side: metadata is published as `{ contentVersion: 4, batchCount: 28, total_questions: 1255, distribution: 20/20/10 }`; verify with `node scripts/check-oir-content-health.js`.
> - Cache side: SQLDelight stores the local content-version mirror and supports reconciliation, missing-batch top-up, and the two-phase readiness contract.
> - App side: `GitLiveOIRQuestionCacheManager` is the sole KMP implementation; metadata failures remain visible and retryable.

### Two-Phase Latency Model
| Phase | Batches | Behaviour |
|---|---|---|
| Phase 1 (blocking) | 1–4 | Downloaded before first test can start |
| Phase 2 (background) | 5..`batchCount` | Downloaded while user takes the first test |

### How a Test Is Assembled (Pool Model, Not Batch-Sequential)

Each OIR test is a **freshly sampled 50-question set** drawn from the **flattened SQLDelight pool (~1,255 questions)** — **NOT** in batch order, and **NOT** from a single batch. `OIRQuestionSelector.selectQuestions(50)` works like this:

1. Query SQLDelight for unused questions of each type (ignoring `batchId`):
   ```sql
   SELECT * FROM cached_oir_questions 
   WHERE type = 'VERBAL_REASONING' 
   AND (lastUsed IS NULL OR lastUsed < 7_days_ago) 
   ORDER BY RANDOM() 
   LIMIT 20
   ```
   A composite index on `(type, lastUsed)` (DB v18) lets SQLite satisfy both predicates in a single index scan before applying `ORDER BY RANDOM()`. NULLs sort first in the ASC index, so `lastUsed IS NULL` is covered by the same range scan as `lastUsed < threshold`.
2. Enforce type distribution — defined **once** in `OIRQuestionDistribution` (domain SSOT), read by the selector. The bank has zero spatial questions, so the live split targets the three populated types via a largest-remainder `counts(total)`:

| Type | Count (of 50) | Ratio |
|---|---|---|
| Verbal Reasoning | 20 | 40% |
| Non-Verbal Reasoning | 20 | 40% |
| Numerical Ability | 10 | 20% |

   (`SPATIAL_REASONING` remains a valid enum value but is no longer a distribution target.)
3. **Selection-time validation:** `fetchByType` over-fetches (×3) and drops anything the domain `OIRQuestionValidator` rejects, so legacy/invalid records (including optionless fill-in-blank questions) are skipped here and never reach the test — keeping the assembled set at full count without deleting the data. Smart redistribution tops up across the three live types if one is short.
4. Questions are sampled **from the whole pool**, **from all batches**, **randomly** — `batchId` is **ignored** during selection.
5. The runtime `OIRQuestionValidator.validateAndFilter` in `OIRTestViewModel` remains as a **defensive assertion** — post-reconcile it should never fire; if it does, it signals an upstream breach and is logged loudly.
6. Final set is shuffled before presentation.

**Validity is defined once (the domain `OIRQuestionValidator`) and enforced at three layers:** the ingestion gate (write-time, new content), the selector (selection-time, skips legacy duds), and the ViewModel (runtime assertion).

**Example:** A user's first test might contain Q1 from `batch_pdf_001` + Q87 from `batch_pdf_002` + Q150 from `batch_pdf_003`, etc. — a random mix.

**7-day reuse window:** Questions unused in the last 7 days are preferred; already-used questions are only drawn when unused supply runs short. After test submission, `markQuestionsUsed()` updates `lastUsed` in SQLDelight.

### Why This Architecture?

| Design Decision | Reason |
|---|---|
| Firestore: 28 batch documents | Tracks download source, version history, audit trail; supports selective re-download |
| SQLDelight: 1 flattened table | Enables efficient type-based random sampling on both Android and iOS |
| Selection: ignore `batchId` | Users get **diverse question coverage** across all 1,255, not exhausting one batch before the next |

### Subscription Limits (per calendar month)
| Tier | OIR tests/month |
|---|---|
| FREE | 1 |
| PRO | 5 |
| PREMIUM | Unlimited |

`canTakeTest(TestType.OIR, userId)` is checked against Firestore before content loading, so clearing the local cache cannot bypass the monthly limit:

- `Eligible` → continue.
- `LimitReached` → stop and show upgrade state.
- `NetworkError` → stop and show retry state.
- Unknown/malformed subscription data → fail closed rather than granting access.

`recordTestUsage()` increments usage atomically in a Firestore transaction after durable submission. Its submission/session identity makes retries idempotent. `markQuestionsUsed()` updates SQLDelight for the 7-day reuse window and is best effort after the durable flow succeeds.

### Start-Gate Decision Table

| Condition | Start behavior |
|---|---|
| No authenticated user | Stop with authentication-required state |
| Limit reached | Stop before question loading; show subscription details/upgrade action |
| Eligibility network or unexpected failure | Stop; show retryable eligibility failure |
| Metadata unavailable or cache sync failed | Stop; show cache retry state |
| Fewer than 50 valid questions or missing a required category | Stop; no session interaction begins |
| Durable session creation failed | Stop; no questions are exposed |
| All gates pass | Create session, expose exactly 50 questions, and start timer |

### Submit Flow
```
canTakeTest()            → Firestore usage check (monthly gate)
  ├─ NetworkError        → retryable error shown (UI stays on home screen)
  ├─ LimitReached        → upgrade prompt shown (fail-closed for unknown errors too)
  └─ Eligible            → continue ↓

getTestQuestions(50)     → SQLDelight query with type distribution + 7-day preference
[user takes test]
SubmitOIRTestUseCase:
  1. scoreCalculator.calculate(session)
  2. submissionRepository.submitOIR(submission)  → durable submissionId
  3. usageRecorder.recordTestUsage(OIR, userId, submissionId) ← idempotent Firestore transaction
  4. testSessionRepository.endTestSession(sessionId)
  5. dashboardUseCase.invalidateCache(userId)
markQuestionsUsed()      → SQLDelight (7-day suppression)
```
A session is created before questions are exposed. Leaving the test marks it `ABANDONED`; a
successful submit marks it `SUBMITTED`; an expired session is terminal `EXPIRED`. Abandoned and
expired sessions are not resumed in the current release — retaking the test is a fresh session, not
a continuation (see Session State Machine below). Result and answer-review routes pass only
the durable submission ID, and the review screen fetches the persisted result through its ViewModel.

**Steps 2–4 share one `runCatching`, not independent recovery.** If step 2 (submission persist)
succeeds but step 3 or 4 then throws, `SubmitOIRTestUseCase` still returns `Result.failure` — the
submission is already durable, but the session never reaches `SUBMITTED` and usage is never
recorded. Same mechanism and consequences as PPDT's identical use-case shape; see `PPDT_Pipeline.md`
§8 for the failure-mode detail and §25 for how to tell "actually failed" apart from "reported
failure, already succeeded" when debugging.

### Session State Machine

A durable Firestore session is created before questions are exposed. Identity fields (`sessionId`, `userId`, `testType`) are immutable.

```text
ACTIVE
  ├─ user exits → ABANDONED (terminal for that attempt; no resume in this release)
  ├─ absolute expiry → EXPIRED (terminal for that attempt)
  └─ successful durable submit → SUBMITTED (terminal for that attempt)
```

"No resume" means the ViewModel never continues an abandoned/expired attempt's in-progress answers — a retake always starts a fresh 50-question session. It does not mean retaking is blocked: the session doc id is `{userId}_{testId}` (reused, not re-minted) and starting a new attempt is a Firestore `create`-shaped write over any prior terminal *or still-`ACTIVE`* doc, gated by `test_sessions`' rule (`PPDT_Pipeline.md` §24). This exact path was broken twice in production ("Could not create a secure test session") — see that section and its §17 #15/#16 for what shipped, why, and the fix.

The timer derives remaining time from the session's absolute expiry rather than counting local ticks. Backgrounding, delayed frames, and device clock drift cannot extend the server-defined session lifetime. Submission is one-shot in the UI and idempotent in the repository/use-case path.

### Firestore Data and Security Model

| Data | Canonical location | Client invariant |
|---|---|---|
| OIR metadata | `test_content/oir/meta/config` | Read-only to app clients; content writes are tooling/server-only |
| OIR batches | `test_content/oir/batches/{batchId}` | Authenticated content reads only |
| Test session | `test_sessions/{userId}_{testId}` (top-level, not nested under `users/`) | Owner-only; identity and terminal transitions are protected |
| Submission/result | `submissions/{submissionId}` (top-level; for OIR, `submissionId == sessionId`) | Owner-only; finalized result fields are immutable |
| Monthly usage | `users/{userId}/subscription/usage_{yyyy-MM}` | Owner-only; month/identity fields are immutable and updates are monotonic |

`test_sessions` and the monthly-usage collection are shared verbatim with every other test type via `TestSessionRepository`/`TestUsageRecorder` — the rule text, the reasoning behind each clause, and the two incidents both collections have already caused in production are documented once, in `PPDT_Pipeline.md` §24 (rules) and §25 (debugging playbook), not repeated here. The Compose UI and ViewModels never call Firebase directly.

### User-Visible State Contract

The OIR UI has explicit states for loading, authentication required, limit reached, cache/content failure, retry, active test, submit confirmation, submission in progress, result loading/error, and answer-review loading/error. Active question controls are hidden while loading or submitting. Image loading failures have an explicit fallback state, and timer/navigation/image controls expose accessibility labels.

### Difficulty-Free Result Contract

OIR no longer classifies or displays Easy/Medium/Hard. New scoring is transparent: each exact correct answer contributes one point, incorrect and skipped answers contribute zero, `rawScore` equals `correctAnswers`, and `percentageScore` is `correctAnswers / totalQuestions * 100`. Results show category performance only for categories with questions, plus correct/incorrect/skipped counts, time taken, raw score, and the actions `Review Answers`, `Take Another Test`, and `Back to Home`.

Historical Firestore result documents may still contain `difficultyBreakdown`, and historical answered questions may still contain `difficulty`; the shared DTO mapper tolerates those fields but new serialization omits the result breakdown and no active OIR UI reads either field. Review uses the existing durable submission ID, while `Take Another Test` returns through the normal eligibility-gated start route.

### Key Files
| File | Responsibility |
|---|---|
| `data-firebase/.../data/repository/GitLiveOIRQuestionCacheManager.kt` | Sync lifecycle, content-version reconciliation, and SQLDelight cache readiness |
| `data-firebase/.../data/repository/GitLiveOIRQuestionSelector.kt` | Type-distribution selection, validity filtering, and 7-day reuse logic |
| `shared/.../domain/model/OIRQuestionDistribution.kt` | Distribution SSOT (V40/NV40/N20, largest-remainder `counts()`) |
| `shared/.../domain/validation/OIRQuestionValidator.kt` | Validity SSOT — enforced at ingestion, selection, and runtime |
| `scripts/oir-extraction/upload-oir-batch.js` (`validateBatch`) | Write-time enforcement of the validator's rules |
| `shared/.../data/repository/SubscriptionDtos.kt` (`SubscriptionLimits`) | Monthly limits — single source of truth |
| `shared/.../domain/usecase/oir/SubmitOIRTestUseCase.kt` | Orchestrates score → durable submit → usage → session end → dashboard invalidation |

### KMP Composition

The OIR business flow is shared across Android and iOS. `sharedModule` declares interfaces and ViewModels; `firebaseDataModule` from `data-firebase` supplies the GitLive/Firebase implementations. Android loads both through its Koin composition root, and iOS loads both through `ensureKoinStarted()`. OIR behavior must not be forked into platform-specific ViewModels, selectors, navigation, or eligibility logic.

### Operational Runbook

Run these commands from the repository root after installing `scripts` dependencies with `npm ci --prefix scripts`:

```bash
# Read-only production verification; no Firestore or Storage writes.
node scripts/check-oir-content-health.js

# Preview the metadata target; dry run is the default.
node scripts/set-oir-meta-config.js

# Explicit production metadata publish after review and confirmation.
node scripts/set-oir-meta-config.js --version 4 --batches 28 --commit
```

The health check must pass before a content release is considered complete. It verifies metadata consistency, exact batch IDs `batch_pdf_001..028`, the 1,255-question total, stable/unique IDs, valid category coverage, HTTPS image URLs, and HTTP 200 responses. The metadata publisher rejects content-version downgrades and removes the obsolete spatial distribution field. Never run a production write from an unreviewed working tree or with credentials committed to source control.

### Validation Map

| Behavior | Primary validation |
|---|---|
| Eligibility and blocked starts | `shared/.../presentation/oir/OIRTestViewModelTest.kt` |
| Exact count/distribution/validity | `OIRTestQuestionSetValidatorTest.kt`, `GitLiveOIRQuestionSelectorTest.kt` |
| Cache reconciliation/readiness | `GitLiveOIRQuestionCacheManagerTest.kt`, `GitLiveTestContentRepositoryContentTest.kt` |
| Session lifecycle/timer | `TestSessionRepository` tests and OIR ViewModel tests |
| Submission, quota, and idempotency | `SubmitOIRTestUseCaseTest.kt`, `GitLiveTestUsageRecorderTest.kt` |
| Firestore ownership/security | `FirebaseRulesValidationTest.kt` and rules emulator tests |
| Result mapping/fallback/review | `SubmissionClusterDtoTest.kt`, result ViewModel/UI tests |
| Dashboard freshness | `GetOLQDashboardUseCaseTest.kt`, `StudentHomeViewModelTest.kt` |
| Production content | `node scripts/check-oir-content-health.js` |

### Current Limitations and Release Evidence

- 186 production records are intentionally skipped by the runtime validator; 1,069 valid records remain available, with sufficient verbal, non-verbal, and numerical coverage.
- Abandoned and expired sessions are terminal and are not resumed.
- Question-use marking is local and best effort; durable submission, usage, and session state are the source of truth.
- The production content-health check is automated and read-only. Full first-time and network-interruption journey smoke tests remain manual release evidence.
- `./gradlew check` is the final project gate; a successful focused OIR test does not replace it.

---

## Applying This Pattern to Future Tests (WAT, SRT, GPE)

1. **Extraction:** Use `oir_extract_v2.py` as reference — text layer for correctness, figure geometry for image assignment, HTML preview gate before upload
2. **Firestore path:** `test_content/{testType}/batches/{batchId}`
3. **Cache:** Follow two-phase pattern in a new `{TestType}QuestionCacheManager`
4. **Selector:** Implement type-distribution ratios appropriate for the new test
5. **Subscription limits:** Add `TestType.{NEW}` case to `SubscriptionLimits.keyFor()` and its limits table (`shared/.../data/repository/SubscriptionDtos.kt`)

---

## Scaling & Expansion

### Can We Add More Questions?

**Yes.** The architecture is designed to scale from 1000 to 10,000+ questions with **zero logic changes**:

| Component | Scaling Capacity | Bottleneck |
|---|---|---|
| Firestore batches | Unlimited (40 batches = 2000 Qs, 100 batches = 5000 Qs, etc.) | Storage cost, not logic |
| SQLDelight local table | Android and iOS devices handle 10,000+ rows comfortably | Device storage, not SQL query speed |
| Selection logic | Works identically | Query still does `ORDER BY RANDOM()` — indexes make it fast |
| Two-phase cache | Adjust Phase 1 count if needed (currently 1–4 = 200 Qs) | Still blocking → background pattern |
| 7-day reuse window | Works better with more questions | More unused questions available |

### How to Add 1000+ More Questions

1. **Extract new batches** via `oir_extract_v2.py`
   - Add new sets to `SET_TABLE` in the script
   - Run extraction for new sets
   
2. **Upload new batches** via `upload-oir-batch.js`
   - Firestore docs automatically written at `test_content/oir/batches/batch_pdf_021`, `batch_pdf_022`, etc.
   - Existing batches (001–020) remain untouched

3. **App automatically downloads new batches**
   - `initialSync()` will detect new batches and phase 2 will download them
   - No code changes needed

4. **Selection logic unchanged**
   - Query still reads from the flattened SQLDelight table
   - Type distribution still enforced
   - 7-day window still applied
   - Users automatically get access to all 1000+ questions

### Cost of Expansion

| Scenario | Firestore Reads | SQLDelight Storage | User Impact |
|---|---|---|---|
| 1,000 Qs (20 batches) | ~20 on first launch | ~50 MB | All batches in ~1 min |
| 5,000 Qs (100 batches) | ~100 on first launch | ~250 MB | Phase 1–4 blocks briefly, then background |
| 10,000 Qs (200 batches) | ~200 on first launch | ~500 MB | Consider increasing Phase 1 batches |

**Optimization if scaling to 10k+:** Increase Phase 1 batches from 1–4 to 1–10 to reduce time-to-first-test.

