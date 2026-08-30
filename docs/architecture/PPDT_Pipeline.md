# PPDT Pipeline Architecture

**Last updated:** 2026-08-09 (added Section 24 "Firestore Security Rules Governing PPDT" and Section 25 "Debugging Playbook" after two production incidents — Section 17 #15–#17 — traced to `firestore.rules`, not application code; KMP-convergence refresh — `shared` is now the SSOT for UI/ViewModel/navigation/use-cases on both Android and iOS; Firebase implementations live in `data-firebase`)
**Status:** Living document — update when fixing bugs, improving flow, or adding features.

Picture Perception and Description Test (PPDT) is a Phase 1 psychology test in SSBMax. The candidate views a blurry image for 30 seconds, then writes a story based on what they perceived. The story is evaluated by Gemini AI against 15 Officer-Like Qualities (OLQs) using multimodal analysis (image + story + per-picture rubric), and the result feeds the unified OLQ dashboard.

**Tier-2 evaluation migration (in progress):** `PPDTAnalysisOrchestrator.analyze()` now checks `FEATURE_FLAG_SERVER_EVALUATION` (`FeatureFlagRepository`) before running the client-side path in §9 below. When enabled, it calls `EvaluationFunctionsClient.evaluatePPDT(submissionId)` instead — a single Cloud Function (`functions/src/evaluation/ppdtEvaluate.js`) that does the fetch, ownership/quota check, Gemini call, and result write server-side; the existing Firestore submission listener picks up the result reactively. The flag defaults off; PPDT cuts over before TAT but after WAT/SRT/SD/Interview/GTO (lowest-risk-first order). §9 below describes the *current default* (client-side) path — accurate until Cutover, at which point this doc must be rewritten around the server path, not left describing dead code. See root `CLAUDE.md`'s Tier-2 evaluation section for cutover status across all test types.

**Migration note:** everything under `app/` in this doc's older revisions (`PPDTTestViewModel`, `SubscriptionManager`, `WorkManager`-direct-enqueue, `TestNavigationEvent`, Room-backed `PPDTImageCacheManager`, `core/domain` model paths) was absorbed into `shared` during the KMP-convergence plan. `app` today is Android platform glue only (`MainActivity`, notifications, WorkManager *worker shells*, Koin bootstrap) — it renders `shared`'s Compose UI and holds no PPDT business logic of its own. iOS renders the same `shared` UI via `SharedKit`. Where this doc says "the ViewModel does X," that's `shared/.../presentation/ppdt/PPDTTestViewModel.kt`, identical on both platforms, unless explicitly marked Android-only.

---

## 1. User Journey Overview

```
StudentHomeScreen
  └─► TopicScreen (Phase 1 → Tests tab)
        └─► PPDTTestScreen
              ├─ [0] PROFILE GATE (gender check — blocks if no profile)
              ├─ [1] INSTRUCTIONS
              ├─ [2] IMAGE_VIEWING  (30 s, auto-advance)
              ├─ [3] WRITING        (4 min, auto-advance)
              ├─ [4] REVIEW
              └─ [5] SUBMITTED ──► PPDTSubmissionResultScreen
                                        └─► OLQ results + per-OLQ reasoning (async, via SubmissionAnalysisTrigger)
```

---

## 2. Navigation & Entry Points

**Route definitions:** `shared/src/commonMain/kotlin/com/ssbmax/navigation/SSBMaxDestinations.kt`

| Destination | Route |
|-------------|-------|
| PPDT test | `test/ppdt/{testId}` |
| PPDT result | `test/ppdt/result/{submissionId}` |

**Route registration:** `shared/src/commonMain/kotlin/com/ssbmax/navigation/PsychTestsGraph.kt` — one nav graph, shared by both platforms (`app`'s `MainActivity` and the iOS entry point both render `shared`'s root composable directly; neither has its own nav graph).

**Entry paths:**
1. `StudentHomeScreen` Phase 1 ribbon → `TopicScreen(topicId="PHASE_1", selectedTab=2)` (Tests tab)
2. `TopicScreen` test list → `PPDTTest.createRoute("ppdt_standard")`
3. `StudentTests` screen → same route

Default `testId` is `ppdt_standard`.

**Known reachability gap** (flagged inline in `PsychTestsGraph.kt`): `PPDTSubmissionResult` has no in-graph "retake" link back to `PPDTTest` — it's only reached via the student-home "view past result" tile. Not a bug, just an asymmetry worth knowing about before adding a retake CTA to the result screen.

---

## 3. Screen & ViewModel Layer

### Main screens

| Screen | File | ViewModel |
|--------|------|-----------|
| `PPDTTestScreen` | `shared/.../ui/ppdt/PPDTTestScreen.kt` | `shared/.../presentation/ppdt/PPDTTestViewModel.kt` |
| `PPDTSubmissionResultScreen` | `shared/.../ui/ppdt/PPDTSubmissionResultScreen.kt` | `shared/.../presentation/ppdtresult/PPDTSubmissionResultViewModel.kt` |

`PPDTTestViewModel` is a real `androidx.lifecycle.ViewModel` (Compose Multiplatform's `viewModelScope`, not a plain class with a manual `close()`), resolved via `koinViewModel()`. Navigation-on-submit uses `LaunchedEffect(uiState.isSubmitted)` watching the `StateFlow` directly — there is no `Channel<TestNavigationEvent>` in this codebase anymore.

### Phase composables

| Composable | File | Responsibility |
|------------|------|----------------|
| `PPDTInstructionsPhase` | `shared/.../ui/ppdt/components/phases/PPDTInstructionsPhase.kt` | 5-point instruction card, "Start Test" button |
| `PPDTImageViewingPhase` | `shared/.../ui/ppdt/components/phases/PPDTImageViewingPhase.kt` | Layout root: instruction card + image card + timer bar |
| `PPDTWritingPhase` | `shared/.../ui/ppdt/components/phases/PPDTWritingPhase.kt` | Text field with char count (min 200, max per-question `maxCharacters`), keyboard padding |
| `PPDTReviewPhase` | `shared/.../ui/ppdt/components/phases/PPDTReviewPhase.kt` | Read-only story preview, "Edit Story" returns to WRITING |

### Shared components

- `PPDTComponents.kt` (`shared/.../ui/ppdt/components/`) — `PPDTTopBar` (phase name, timer, exit), `PPDTBottomBar` (Next/Review/Submit)
- `PPDTDialogs.kt` — `PPDTExitDialog`, `PPDTSubmitDialog`, `PPDTProfileRequiredDialog` (shown when profile has no gender)
- `PPDTOLQReasoningCard.kt` — expandable per-OLQ reasoning card shown in result screen

### Exit / back handling (both platforms)

`PPDTTestScreen` wires **both** the exit-dialog X button and hardware/predictive back to the same path: `showExitDialog = true` → confirm → `viewModel.pauseTest()` → `onNavigateBack()`. The `BackHandler(enabled = uiState.session != null && !uiState.isSubmitted)` call is what makes hardware/predictive back go through the dialog instead of silently popping the nav stack — see Section 17, "stuck-ACTIVE test_sessions" entry, for why this matters.

---

## 4. UiState & Phase State Machine

**`PPDTTestUiState`** (`shared/.../presentation/ppdt/PPDTTestUiState.kt`, exposed by `PPDTTestViewModel` as `StateFlow<PPDTTestUiState>`):

```kotlin
data class PPDTTestUiState(
    val isLoading: Boolean = true,
    val loadingMessage: String? = null,
    val error: TestError? = null,           // typed error, not raw exception text

    val currentPhase: PPDTPhase = PPDTPhase.INSTRUCTIONS,
    val session: PPDTTestSession? = null,    // sessionId, questionId, story, isPaused, etc.

    val imageUrl: String = "",
    val story: String = "",
    val charactersCount: Int = 0,
    val minCharacters: Int = 200,
    val maxCharacters: Int = 1000,           // pre-load fallback only — PPDTQuestion.maxCharacters
                                              // itself defaults to 1500; the real per-question value
                                              // overwrites this once the question loads

    val timeRemainingSeconds: Int = 0,
    val isTimerActive: Boolean = false,
    val timerStartTime: Long = 0L,

    val canProceedToNextPhase: Boolean = false,
    val isSubmitted: Boolean = false,
    val submissionId: String? = null,
    val subscriptionType: SubscriptionTier? = null,   // was SubscriptionType pre-KMP; SSOT enum is SubscriptionTier
    val submission: PPDTSubmission? = null,

    val isLimitReached: Boolean = false,
    val subscriptionTier: SubscriptionTier = SubscriptionTier.FREE,
    val testsLimit: Int = 1,
    val testsUsed: Int = 0,
    val resetsAt: String = "",

    val isProfileIncomplete: Boolean = false
)
```

**Phase transitions:**

```
INSTRUCTIONS
  ──[startTest()]──►
IMAGE_VIEWING  (30 s timer)
  ──[timer = 0, auto]──►
WRITING  (240 s timer)
  ──[story ≥ 200 chars, proceedToNextPhase()]──►
REVIEW
  ──[returnToWriting()]──► WRITING
  ──[submitTest()]──►
SUBMITTED  ──[isSubmitted flips, LaunchedEffect fires]──► result screen
```

**`PPDTPhase` enum:** `INSTRUCTIONS`, `IMAGE_VIEWING`, `WRITING`, `REVIEW`, `SUBMITTED`

---

## 5. Timer Logic

### Timers

| Phase | Duration | Trigger |
|-------|----------|---------|
| IMAGE_VIEWING | 30 s | `startTest()` → `startTimer(30)` |
| WRITING | 240 s | `proceedToNextPhase()` → `startTimer(240)` |

Both timers auto-advance the phase when they reach 0. `TimerChip` shows MM:SS and turns error-red when < 30 s remaining.

### Generation-token race guard

`timerStartTime: Long` in `PPDTTestUiState` is a generation token: each `startTimer()` call increments a ViewModel-private `timerGeneration` and writes it into `timerStartTime`. The dying timer coroutine's `finally`/completion path only clears `isTimerActive` if `current.timerStartTime == myGeneration`. This prevents the 30 s IMAGE_VIEWING timer's completion handler from flipping `isTimerActive = false` after the 240 s WRITING timer has already set it `true` — the exact pattern documented in `docs/architecture/TAT_Pipeline.md` §5 and reused verbatim across TAT/WAT/SRT/SDT's KMP ports.

---

## 6. Image Loading Pipeline

### Source (Firestore)

```
test_content/ppdt/image_batches/{batchId}
  ├── totalImages: Int
  └── images: List<{
        id: String,
        imageUrl: String,           ← Firebase Storage URL
        imageDescription: String,
        imageContext: {             ← structured PPDTImageContext
          sceneDescription, coreElements[], ambiguousElements[],
          expectedThemes[], penalizedThemes[], primaryOLQs[],
          deviationTolerance, exemplarGoodHints[], exemplarBadHints[]
        },
        genderTag: String,          ← "MALE" | "FEMALE" | "MIXED"
        viewingTimeSeconds: 30,
        writingTimeMinutes: 4,
        minCharacters: 200,
        maxCharacters: 1000,
        category, difficulty
      }>
```

Active batch: `batch_001` (64 images).

### Local cache (SQLDelight, `data-firebase`)

**`GitLivePPDTImageCacheManager`** — `data-firebase/src/commonMain/kotlin/com/ssbmax/shared/data/repository/GitLivePPDTImageCacheManager.kt`. This is the sole implementation on both platforms, replacing the Android-only Room-backed `PPDTImageCacheManager`/`CachedPPDTImageEntity` (both deleted in the KMP-convergence plan). Backed by SQLDelight (`SharedDatabase`/`sharedDatabaseQueries`), not Room.

- **Constants:** `TARGET_CACHE_SIZE = 15`, `MIN_CACHE_SIZE = 5`, `DEFAULT_BATCH_ID = "batch_001"`, `STALENESS_TTL_HOURS = 24`
- **`initialSync()`:** if local count ≥ target and not stale → no-op; if stale → clear table + re-download the whole batch; if local count < target → download the batch.
- **`getImageForTest()`:** if local count < `MIN_CACHE_SIZE` (5), triggers `initialSync()` first; then picks the least-used image (optionally gender-filtered at the SQL layer, not in-memory), marks it used.
- **Staleness check:** gated by the 24h TTL — only re-checks Firestore's `version` field once `hoursSinceCheck >= STALENESS_TTL_HOURS`; on a Firestore fetch failure, serves the stale cache rather than failing (fail-safe).
- `imageContext` is stored as a serialized JSON string (`imageContextJson`), decoded via kotlinx.serialization; a parse failure degrades to `PPDTImageContext()` defaults rather than crashing. The Room-era `localFilePath`/`imageDownloaded` fields were dropped entirely — they were dead even on Android.
- Test: `data-firebase/src/androidUnitTest/kotlin/com/ssbmax/shared/data/repository/GitLivePPDTImageCacheManagerTest.kt`.

### Gender-based image routing

```
loadTest()
  └─ LoadPPDTTestUseCase resolves GenderTag from profile
       └─ UserProfileRepository.getUserProfile(userId)
            ├─ profile == null (server confirms no profile) → ProfileIncompleteException → isProfileIncomplete=true, stop
            ├─ gender == MALE   → GenderTag.MALE   → MALE+MIXED pool
            ├─ gender == FEMALE → GenderTag.FEMALE → FEMALE+MIXED pool
            └─ gender == OTHER / network error → null → full pool (no filter)
```

### Display (UI)

Coil (Compose Multiplatform) loads `imageUrl` into an `AsyncImage`. The image card is sized `Modifier.aspectRatio(4f / 3f)` with `ContentScale.Crop` — PPDT images are landscape 4:3; this avoids letterboxing/whitespace bands above and below the image.

---

## 7. Subscription Check

Called before test content loads, inside `PPDTTestViewModel.loadTest()`:

```
CheckTestEligibilityUseCase(TestType.PPDT, userId)
  → TestEligibility.Eligible | TestEligibility.LimitReached | TestEligibility.NetworkError
```

`SubscriptionManager` no longer exists anywhere in this codebase — `CheckTestEligibilityUseCase` (`shared/.../domain/usecase/subscription/`) is the sole eligibility SSOT, backed by `SubscriptionLimits`.

- `TestEligibility.LimitReached` → `isLimitReached = true` → `TestLimitReachedDialog` shown; test does not load.
- `TestEligibility.NetworkError` → typed `TestError`, test does not load.
- Usage recorded via `TestUsageRecorder.recordTestUsage(...)` on successful submission (see Section 8) — not a direct Firestore increment inside the ViewModel, and as of Phase 5 (docs/plans/CrossPlatform_SSOT) not a direct Firestore write at all: it calls the server-side `recordTestUsage` Cloud Function.
- **Debug override:** the old `BuildConfig.BYPASS_SUBSCRIPTION_LIMITS` flag is gone (Android-only, never wired on iOS, retired by the dev-subscription-override plan). Settings → Developer Settings → **Subscription Override** now does the same job on both platforms without a rebuild: `Follow Real` / `Force Free` / `Force Pro` / `Force Premium` changes what every eligibility/limit read sees; usage counters are not incremented while overridden.

---

## 8. Submission Flow

`PPDTTestViewModel.submitTest()` → `SubmitPPDTTestUseCase(session)` → on success, three more side effects fire from the ViewModel itself.

**Inside `SubmitPPDTTestUseCase`** (`shared/.../domain/usecase/ppdt/SubmitPPDTTestUseCase.kt`):
1. Resolve `subscriptionType` via `GetSubscriptionTierUseCase`
2. Build `PPDTSubmission` (story, timings, userId, userName, status = `SUBMITTED_PENDING_REVIEW`, `analysisStatus = PENDING_ANALYSIS`)
3. `SubmissionRepository.submitPPDT(submission, batchId = null)` → Firestore `submissions/{submissionId}` (see Section 11)
4. `TestUsageRecorder.recordTestUsage(TestType.PPDT, userId, submissionId)`
5. `TestSessionRepository.completeTestSession(session.sessionId)` — **marks the durable session terminal.** This call was missing entirely until commit `6a9a7c1c` (2026-08-08); see Section 17.

**Back in `PPDTTestViewModel.submitTest()`, after the use case returns success:**
6. `SubmissionAnalysisTrigger.trigger(TestType.PPDT, submissionId)` — kicks off background AI analysis (Section 9)
7. `DifficultyProgressionRepository.recordPerformance(...)` — local difficulty-adaptation bookkeeping, Android/data concern kept in the ViewModel rather than the use case
8. UiState updates: `isSubmitted = true`, `phase = SUBMITTED` → `PPDTTestScreen`'s `LaunchedEffect(uiState.isSubmitted)` navigates to the result screen

On failure, `Result.failure` surfaces as `TestError.SUBMIT_FAILED`.

**⚠️ Steps 3–5 share one `runCatching` with no per-step recovery.** If step 3 (the `submissions/{id}` write) succeeds but step 4 or 5 then throws, the whole use case still reports failure — even though the submission is already durably in Firestore. Consequences: step 6 never runs, so analysis is never triggered and the submission sits at `PENDING_ANALYSIS` forever; the session (step 5 didn't run) stays `ACTIVE`; the user sees "Failed to submit" for a submission that, server-side, already succeeded. **Do not assume a "submission failed" report means the `submissions/{id}` write is broken** — check whether that document exists before debugging step 3. Real incident: Section 17 #17. Diagnostic method: Section 25.

---

## 9. Background Analysis

Analysis is no longer a single Android-only `WorkManager` worker end-to-end — it's split into a platform-neutral trigger interface, a platform-specific dispatch mechanism, and a shared orchestrator that does the actual work.

| Layer | File | Module | Role |
|-------|------|--------|------|
| Trigger interface | `SubmissionAnalysisTrigger.kt` | `shared` | `fun trigger(testType: TestType, submissionId: String)` — `shared` cannot depend on `app`'s concrete Worker classes, so this seam exists so `PPDTTestViewModel` (and TAT/WAT/SRT/SDT's) can call one platform-neutral API |
| Android impl | `WorkManagerSubmissionAnalysisTrigger.kt` | `app` | Enqueues the real `PPDTAnalysisWorker` via WorkManager; bound in `app`'s `workManagerModule`, Koin last-wins over `shared`'s default binding |
| iOS/shared-default impl | `KtorSubmissionAnalysisTrigger.kt` | `shared` | Dispatches immediately in-foreground (not via `BGTaskScheduler`) straight into the per-test-type orchestrator |
| **Actual analysis logic** | `PPDTAnalysisOrchestrator.kt` | `shared` | The real work — see steps below. Single source of truth for both platforms |
| Android WorkManager shell | `PPDTAnalysisWorker.kt` | `app` | Thin: re-checks `PENDING_ANALYSIS`, calls `orchestrator.analyze(submissionId)`, re-reads status to pick a WorkManager `Result`, fires the Android push notification. Retries up to `MAX_WORKER_RETRIES = 3` |

**`PPDTAnalysisOrchestrator.analyze(submissionId)` steps:**

| Step | Action |
|------|--------|
| 1 | Fetch submission; verify `analysisStatus == PENDING_ANALYSIS` (idempotency guard) |
| 2 | Update Firestore: `analysisStatus → ANALYZING` |
| 3 | Resolve `candidateGender`: `UserProfileRepository.getUserProfile(userId).gender` — falls back gracefully if fetch fails |
| 4 | Fetch `PPDTQuestion` (image cache → Firestore fallback via `TestContentRepository`); includes `imageUrl` and structured `imageContext` |
| 5 | Download image bytes via Ktor `HttpClient` (best-effort) |
| 6 | Build multimodal Gemini prompt: `PPDTPrompts.generatePPDTMultimodalPrompt(story, imageContext, candidateGender)` |
| 7 | Call Gemini via `KtorPPDTAnalyzer` — model `gemini-2.5-flash`, 60 s timeout, `AnalysisRetry.withRetry` (3 attempts, exponential backoff) |
| 8 | Parse JSON response → 15 `OLQScore` objects (each with `score`, `confidence`, `reasoning`) |
| 9 | `ValidationIntegration.validateScores(olqScores, entryType)` — SSB Factor II critical rules |
| 10 | Build `OLQAnalysisResult` via `PPDTRating.fromScore` (overallScore = avg of 15, top 3 strengths, bottom 3 weaknesses) |
| 11 | `SubmissionRepository.updatePPDTOLQResult(...)` — single Firestore **batch** write: `ppdt_results/{submissionId}` (full result) + `submissions/{submissionId}` (`analysisStatus`/`status` → `COMPLETED`) |
| 12 | `GetOLQDashboardUseCase.invalidateCache(userId)` + push notification (Android, from the Worker shell) |

**Error path:** on failure after retries → `analysisStatus = FAILED`; Android's Worker shell fires a failure notification and returns a WorkManager failure `Result`.

**Key implementation files:**
- `PPDTAnalysisOrchestrator.kt` (`shared/.../analysis/`) — orchestration
- `KtorPPDTAnalyzer.kt` (`shared/.../ai/`) — multimodal Gemini call + response parsing, wraps `KtorGeminiClient` + `KtorGeminiResponseParser.parseGTOAnalysisResponse`
- `PPDTPrompts.kt` (`shared/.../ai/prompts/`) — `generatePPDTMultimodalPrompt()`
- `PPDTAnalysisWorker.kt` (`app/.../workers/`) — Android WorkManager shell only

---

## 10. Gemini AI Prompt Design

**Prompt builder:** `shared/.../ai/prompts/PPDTPrompts.kt` → `generatePPDTMultimodalPrompt(story, imageContext, candidateGender)`

The prompt sends **both image bytes and a per-picture rubric** to Gemini (multimodal). Gemini directly verifies scene accuracy from the image; the rubric controls what to reward and penalize.

**Prompt structure:**
```
[IMAGE BYTES attached via content { inlineData(imageBytes, "image/jpeg") }]

=== PICTURE BRIEFING ===
Scene: {imageContext.sceneDescription}
Core elements (MUST acknowledge — EFFECTIVE_INTELLIGENCE penalty if missed): ...
Ambiguous elements (creative interpretation acceptable — picture is hazy): ...
Penalized story themes (heavy penalty): ...
Primary OLQs this picture tests: ...
Deviation tolerance: LOW | MEDIUM | HIGH

=== CANDIDATE STORY ===
{story}  (Length: N chars | Writing time: 4 min)

=== CANDIDATE PROFILE ===
Gender: {candidateGender}

=== SSB SCORING SCALE (LOWER = BETTER) ===
[scoring rules block]

=== OUTPUT FORMAT (JSON only) ===
{ "olqScores": { "EFFECTIVE_INTELLIGENCE": {"score": 6, "confidence": 85, "reasoning": "..."}, ... } }
```

**Scoring scale:** 1–10, **LOWER = BETTER** (SSB convention)

| Rating | Score Range |
|--------|-------------|
| Exceptional | ≤ 3 |
| Good | ≤ 5 |
| Average | ≤ 7 |
| Needs Improvement | > 7 |

**Determinism:** `temperature = 0.0` default parameter of `KtorGeminiClient.generateContent` — identical story → identical score always.

---

## 11. Firestore Data Model

Write code confirmed current in `data-firebase/src/commonMain/kotlin/com/ssbmax/shared/data/repository/GitLivePersonalTestSubmissionRepository.kt` + `PPDTSubmissionMappers.kt`.

### `submissions/{submissionId}`

```
submissions/{submissionId}
  ├── id: String
  ├── userId: String
  ├── testType: "PPDT"
  ├── testId: String              ← mapped from questionId
  ├── status: String              ← "SUBMITTED_PENDING_REVIEW" | "COMPLETED"
  ├── submittedAt: Long
  ├── batchId: String?
  ├── gradedByInstructorId: String?
  ├── gradingTimestamp: Long?
  └── data: Map
      ├── submissionId, questionId, userId, userName, userEmail, batchId
      ├── story: String
      ├── charactersCount: Int
      ├── viewingTimeTakenSeconds: Int
      ├── writingTimeTakenMinutes: Int
      ├── submittedAt: Long
      ├── status: String
      ├── analysisStatus: String   ← PENDING_ANALYSIS | ANALYZING | COMPLETED | FAILED
      ├── olqResult: Map?          ← OLQAnalysisResult when COMPLETED
      └── instructorReview: Map?
```

### `ppdt_results/{submissionId}`

PPDT keeps its own dedicated results collection (the "GTO pattern") rather than the shared `psych_results` collection TAT/WAT/SRT/SDT write to:

```
ppdt_results/{submissionId}
  ├── submissionId: String
  ├── userId: String
  ├── testType: "PPDT"
  ├── olqScores: Map<OLQ, { score: Int, confidence: Int, reasoning: String }>
  ├── overallScore: Float          ← average of 15 scores (1–10 SSB scale)
  ├── overallRating: String
  ├── strengths: List<String>      ← top 3 lowest-score OLQs
  ├── weaknesses: List<String>     ← top 3 highest-score OLQs
  ├── recommendations: List<String>
  ├── aiConfidence: Int            ← 0–100
  └── analyzedAt: Long
```

`updatePPDTOLQResult` writes both `ppdt_results/{id}` and flips `submissions/{id}`'s status fields in one Firestore batch — the result and the terminal status land atomically.

### `test_content/ppdt/image_batches/{batchId}`

```
test_content/ppdt/image_batches/{batchId}
  ├── totalImages: Int
  └── images: List<{
        id: String,
        imageUrl: String,
        imageDescription: String,
        imageContext: {
          sceneDescription: String,
          coreElements: List<String>,
          ambiguousElements: List<String>,
          expectedThemes: List<String>,
          penalizedThemes: List<String>,
          primaryOLQs: List<String>,
          deviationTolerance: "LOW" | "MEDIUM" | "HIGH",
          exemplarGoodHints: List<String>,
          exemplarBadHints: List<String>
        },
        genderTag: "MALE" | "FEMALE" | "MIXED",
        category: String,
        difficulty: String,
        viewingTimeSeconds: Int,
        writingTimeMinutes: Int,
        minCharacters: Int,
        maxCharacters: Int
      }>
```

### `test_sessions/{userId_testId}`

Durable session doc, shared across all test types (same `TestSessionRepository` for every `Submit*`/`Load*TestUseCase`). Doc id is deterministic (`{userId}_{testId}`) and reused across retakes, so `createTestSession()` is a `set()` (full-document replace), not always an insert.

```
id, userId, testId, testType: String
startTime, expiresAt: Long        ← expiresAt = startTime + 2h; informational only, not a security boundary (Section 24)
isActive: Boolean
status: String                    ← "ACTIVE" | "SUBMITTED" | "ABANDONED" | "EXPIRED"
endTime: Long?                    ← set only by a terminal transition
```

**PPDT's lifecycle:**

```
        LoadPPDTTestUseCase.createTestSession()
                    │
                    ▼
                ┌────────┐
     ┌─────────►│ ACTIVE │◄────────────────┐  owner restarts over their own
     │          └───┬────┘                  │  session (retake, or reclaiming
clean submit         │ exit → pauseTest()      │  a session stuck ACTIVE by a
(step 5, Section 8)   │ → abandonTestSession     │  failed load/submit)
                      ▼                       │
              ┌───────────┐   ┌───────────┐    │
              │ SUBMITTED │   │ ABANDONED │────┘
              └───────────┘   └───────────┘
```

Every transition here — including `ACTIVE → ACTIVE` — is gated by `firestore.rules`' `test_sessions` rule, the single most-incident-prone part of this pipeline. Rule + reasoning: Section 24. Incidents: Section 17 #15/#16.

---

## 12. OLQ Scoring System & Dashboard

### 15 Officer-Like Qualities (4 SSB Factors)

| Factor | Category | OLQs | Variance |
|--------|----------|------|---------|
| I — Planning & Organizing | INTELLECTUAL | EFFECTIVE_INTELLIGENCE, REASONING_ABILITY, ORGANIZING_ABILITY, POWER_OF_EXPRESSION | ±1 tick |
| II — Social Adjustment ⚠️ CRITICAL | SOCIAL | SOCIAL_ADJUSTMENT, COOPERATION, SENSE_OF_RESPONSIBILITY | ±1 tick |
| III — Social Effectiveness | DYNAMIC | INITIATIVE, SELF_CONFIDENCE, SPEED_OF_DECISION, INFLUENCE_GROUP, LIVELINESS | ±2 ticks |
| IV — Character | CHARACTER | DETERMINATION, COURAGE, STAMINA | ±2 ticks |

**Auto-reject rule:** Factor II overall score ≥ 8 → automatic rejection flag.
**Critical OLQs:** REASONING_ABILITY, all Factor II, LIVELINESS, COURAGE — score ≥ 8 triggers review.

### Dashboard integration

- **`GetOLQDashboardUseCase`** (`shared/.../domain/usecase/dashboard/`) fetches all test results in parallel.
- PPDT result arrives via `OLQDashboardData.Phase1Results.ppdtOLQResult`.
- Each test type has a **6-second timeout** (`PER_TYPE_TIMEOUT_MS`) — slow Firestore doesn't block the whole dashboard.
- **5-minute in-memory cache** (`CACHE_TTL_MS`) reduces Firestore reads; invalidated by `PPDTAnalysisOrchestrator.analyze()` after a successful write.
- Pre-computed once in the use case: top 3 strengths, bottom 3 weaknesses, overall average — not on every UI recomposition.

---

## 13. Result Screen Flow

`PPDTSubmissionResultViewModel.loadSubmission(submissionId)` (`shared/.../presentation/ppdtresult/`):

1. Opens a real-time Firestore listener via `SubmissionRepository.observePPDTSubmission(submissionId)`
2. When `analysisStatus == COMPLETED` detected → calls `getPPDTResult(submissionId)` (reads `ppdt_results`), then cancels the listener coroutine — Firestore re-fires the `COMPLETED` snapshot on any subsequent document update, and without this cancel each re-fire would re-call `getPPDTResult()` (duplicate reads + duplicate UI updates)
3. Builds `SSBRecommendationUIModel` from OLQ scores
4. Exposes `PPDTSubmissionResultUiState` (implements `UnifiedResultUiState` — shared interface across all test result ViewModels)

**`CancellationException` contract:** the failure path always re-throws `CancellationException` before treating anything as an error — a navigate-away (which cancels the scope) must not be surfaced as `uiState.error`.

```kotlin
data class PPDTSubmissionResultUiState(
    override val isLoading: Boolean = true,
    val submission: PPDTSubmission? = null,
    override val ssbRecommendation: SSBRecommendationUIModel? = null,
    override val error: String? = null
) : UnifiedResultUiState {
    override val analysisStatus get() = submission?.analysisStatus ?: PENDING_ANALYSIS
    override val olqResult get() = submission?.olqResult
}
```

The result screen polls by observing the Flow — no manual refresh required.

**Per-OLQ reasoning:** `PPDTSubmissionResultScreen` (via the shared `UnifiedOLQResultTemplate`) renders `PPDTOLQReasoningCard(olqResult)` when `analysisStatus == COMPLETED`. Each OLQ row is expandable and shows `OLQScore.reasoning` from the Gemini response — giving candidates specific feedback on why they scored low.

---

## 14. Domain Models Quick Reference

| Class | File | Purpose |
|-------|------|---------|
| `PPDTQuestion` | `shared/.../domain/model/PPDTTest.kt` | Image URL, `imageContext` (structured), `genderTag`, viewing/writing time config |
| `PPDTImageContext` | same | Structured per-picture rubric: sceneDescription, coreElements, ambiguousElements, expectedThemes, penalizedThemes, primaryOLQs, deviationTolerance, exemplarHints |
| `GenderTag` | same | `MALE`, `FEMALE`, `MIXED` — used for image routing and cache filtering |
| `DeviationTolerance` | same | `LOW`, `MEDIUM`, `HIGH` — controls how strictly scene accuracy is enforced in prompt |
| `PPDTRating` | same | `fromScore()` maps an average score to a rating band |
| `PPDTSubmission` | same | Full submission including story, timings, `analysisStatus`, `olqResult` |
| `PPDTPhase` | same | Enum: INSTRUCTIONS → IMAGE_VIEWING → WRITING → REVIEW → SUBMITTED |
| `PPDTTestSession` | same | Active session tracking (sessionId, questionId, story, isPaused) |
| `PPDTTestConfig` | same | Defaults for timing & character limits |
| `PPDTDetailedScores` | same | Instructor grading breakdown (perception, imagination, narration, characterDepiction, positivity) |
| `PPDTInstructorReview` | same | Manual instructor review (instructorId, finalScore 0–100, agreedWithAI) |
| `OLQAnalysisResult` | `shared/.../domain/model/scoring/UnifiedOLQResult.kt` | Unified AI result (15 OLQ scores with reasoning, overallScore, rating, strengths, weaknesses) |
| `OLQ` | `shared/.../domain/model/interview/OLQ.kt` | Enum of all 15 qualities with Factor grouping & critical-flag metadata (shared across all test types) |
| `AnalysisStatus` | `UnifiedOLQResult.kt` | PENDING_ANALYSIS, ANALYZING, COMPLETED, FAILED |

All PPDT-specific models above live in **one file**, `shared/src/commonMain/kotlin/com/ssbmax/shared/domain/model/PPDTTest.kt` — not `core/domain/.../model/PPDTTest.kt` (that module no longer exists).

---

## 15. Test Coverage

| Test File | Module | What It Covers |
|-----------|--------|----------------|
| `presentation/ppdt/PPDTTestViewModelTest.kt` | `shared` (commonTest) | Auth gate, limit-reached, profile-incomplete, load→INSTRUCTIONS, startTest→IMAGE_VIEWING timer, updateStory, submitTest completes session + triggers analysis, submitTest records difficulty performance, submit failure surfaces error, **pauseTest abandons the durable session**, pauseTest no-op with no session |
| `presentation/ppdtresult/PPDTSubmissionResultViewModelTest.kt` | `shared` (commonTest) | Submission-not-found error, pending analysis surfaces submission without result, completed analysis fetches OLQ result + SSB recommendation, result-fetch failure logged not fatal |
| `analysis/PPDTAnalysisOrchestratorTest.kt` | `shared` (commonTest) | Orchestrator writes OLQ result when AI succeeds, marks FAILED when AI never succeeds |
| `ai/prompts/PPDTPromptsTest.kt` | `shared` (commonTest) | Prompt: core elements, penalized themes, candidate gender present, empty-context placeholder handling |
| `domain/model/PPDTImageContextTest.kt` | `shared` (commonTest) | Default empty lists, `DeviationTolerance` has exactly 3 levels, `PPDTQuestion.imageContext` backward-compat default |
| `domain/model/PPDTQuestionDefaultsTest.kt` | `shared` (commonTest) | Model defaults: `minCharacters` = 200, `maxCharacters` = **1500** (the UiState's 1000 is a pre-load fallback only, not the model default — see Section 4) |
| `domain/usecase/ppdt/LoadPPDTTestUseCaseTest.kt` | `shared` (androidUnitTest) | Gender-tag mapping (male/female/other/network-error), null-profile → `ProfileIncompleteException`, success returns INSTRUCTIONS session, session/question fetch failure propagation |
| `domain/usecase/ppdt/SubmitPPDTTestUseCaseTest.kt` | `shared` (androidUnitTest) | **`invoke completes the durable test session after a successful submission`**, completes only after submission+usage recording succeed, does NOT complete session when submission persistence fails |
| `ui/ppdt/PPDTTestScreenUiTest.kt` | `shared` (androidUnitTest) | Compose UI semantics: instructions start action, image-viewing timer semantics, writing-phase private text input, review-phase submit confirmation, profile-required state, loading/error state, submitted state passes only submissionId+tier |
| `GitLivePPDTImageCacheManagerTest.kt` | `data-firebase` (androidUnitTest) | Gender-tag filtering never crosses genders, marks image used exactly once, normalizes `gs://` URLs to https, `getImageById` fails honestly for unknown id, cache-status counts, `clearCache` empties table |
| `workers/PPDTAnalysisWorkerTest.kt` | `app` (test) | Thin-shell coverage: doWork fails on missing submission, skips delegating when not `PENDING_ANALYSIS`, delegates+success+notification, failure+notification when non-`COMPLETED`, retries then fails after max attempts |

Run all PPDT-relevant tests:

```bash
./gradlew :shared:testDebugUnitTest --tests "*PPDT*"
./gradlew :data-firebase:testDebugUnitTest --tests "*PPDT*"
./gradlew :app:testDebugUnitTest --tests "*PPDT*"
```

`core:domain`/`core:data` no longer exist (deleted into `shared` in the KMP-convergence plan's Phase 9f) — there is no separate module-level test split to remember beyond the three above.

**Rules-layer coverage — not Kotlin, not in the table above, and easy to forget exists:**

| Test File | What It Covers |
|-----------|-----------------|
| `firestore-tests/test_sessions.rules.test.mjs` | Every legal/illegal `test_sessions` transition — terminal, retake, reclaim-while-still-`ACTIVE`, ownership, field immutability. Directly guards Section 24's `test_sessions` rule and the Section 17 #15/#16 incidents. |
| `firestore-tests/subscription_usage.rules.test.mjs` | The real `usage_{month}` write shape (doc id vs. field value), update-rule per-counter increment bounds. Directly guards Section 17 #17. |
| `firestore-tests/REQUIRED_TESTS.txt` + `verify-required-tests.mjs` | A tripwire, not a test suite — fails CI (via npm's `pretest` hook, so it also runs on a plain local `npm test`) if any test listed in the manifest is deleted or renamed without a matching edit to the manifest itself. See Section 24's closing note. |

Run via `firebase emulators:exec --only firestore --project demo-ssbmax-rules-test "npm --prefix firestore-tests test"` — this is exactly what the `firestore-rules` CI job runs, and that job is a dependency of `main`'s required `CI Success` branch-protection check. **This is the only test layer that exercises `firestore.rules` directly** — none of the Kotlin tests in the table above do; they mock the repository interfaces, so a rules regression is invisible to Kotlin tests by construction, however thorough. See Section 24 and Section 25.

---

## 16. Content Ingestion Scripts

### Python pipeline (active)

**Directory:** `scripts/ppdt-picture-pipeline/`

| Script | Purpose |
|--------|---------|
| `step1_extract_cards.py` | Crop 2×2 grid PNGs → 64 individual JPEGs, strip caption bars (bottom 18% of each quadrant) |
| `step2_generate_context.py` | Gemini-expanded `PPDTImageContext` JSON for each image; checkpoint-based resumable; 1 req/s rate limit; HTML preview gate |
| `step3_upload.py` | Delete old Storage images, upload 64 new JPEGs, overwrite Firestore `batch_001` (idempotent, `--dry-run` flag available) |
| `gender_map.json` | Hardcoded gender classification for all 64 image IDs (MALE / FEMALE / MIXED) |
| `preview_template.html` | Jinja2 template: image + context fields + genderTag badge side-by-side; red flag on invalid OLQ names |

**Ingestion principle (from `CLAUDE.md`):** LLM is NOT used for `imageUrl` or `imageDescription` — these are set deterministically. LLM (Gemini) is only used for enriching `PPDTImageContext` fields (themes, OLQs, hints). Human review of `preview.html` is a mandatory gate before any Firestore write.

### Legacy Node.js scripts (superseded)

| Script | Status |
|--------|--------|
| `upload_ppdt_images.js` | Superseded by Python pipeline |
| `upload_ppdt_images_simple.js` | Superseded |

Deleted 2026-08-30 (image-CSP/`makePublic()` migration, Phase 4): `update_ppdt_urls_smart.js`,
`update_ppdt_urls_fixed.js`, `update_ppdt_image_urls.js`, `make_ppdt_images_public.js`,
`add_remaining_ppdt_images.js`, `upload_ppdt_images.sh`, and the stale `PPDT_IMAGES_READY.txt`/
`PPDT_IMAGE_UPLOAD_GUIDE.txt`/`PPDT_UPLOAD_README.txt` guides — all dead code/docs for the
`makePublic()`-based flow this table already listed as superseded by `step3_upload.py`. The
remaining two above are kept since they don't use `makePublic()` and weren't in that migration's
scope, but they are still superseded by the Python pipeline for actual uploads.

---

## 17. Known Issues & Improvement Areas

_Update this section as bugs are found and improvements are made._

| # | Area | Issue / Improvement | Status |
|---|------|---------------------|--------|
| 1 | Image download in analysis | Ktor `HttpClient` download of the image is best-effort with no dedicated retry beyond `AnalysisRetry.withRetry`'s outer 3 attempts; a persistently-unreachable image URL degrades to `ByteArray(0)` for that attempt. | Deferred |
| 2 | `PPDTTestViewModel` file size | Historically ~620 lines pre-migration; the KMP port carries this forward. Consider a split (e.g. submit/analysis concerns into a delegate) if it grows further. | Deferred |
| 3 | OLQ Reasoning in other tests | `PPDTOLQReasoningCard` is PPDT-only. TAT/WAT/SRT/SDT result screens do not yet show per-OLQ reasoning. When those screens need it, move the card into `UnifiedOLQResultTemplate` as an optional slot. | Deferred to future phase |
| 4 | Profile gate condition | Gate triggers only when `profile == null` (server confirms no profile). If profile exists but gender field is null, the user is NOT gated — they get the full image pool. Intentional (lenient); if stricter gating is required, update the gender-resolution condition in `LoadPPDTTestUseCase`. | Intentional design choice |
| 5 | `analyzePPDTResponse` legacy | Text-only method fully removed from the AI service interface. No callers remain. | ✅ Cleaned up |
| 6 | **Cache staleness after batch update (Room era)** | Historical: the pre-KMP Room cache used a count-only guard that never checked batch version, so a Firestore content replacement kept serving stale images indefinitely until a version-comparison staleness gate was added. **Superseded:** Room and this fix are both gone — `GitLivePPDTImageCacheManager` (Section 6) implements the same version-comparison + fail-safe design natively in SQLDelight. | ✅ Superseded by KMP migration |
| 7 | **Room migration schema mismatch (Room era)** | Historical Room entity/migration drift bug (mismatched defaults/indices), specific to the deleted `CachedPPDTImageEntity`/`MIGRATION_21_22`. No longer applicable — SQLDelight has no equivalent migration-vs-entity drift class of bug. | ✅ Superseded by KMP migration |
| 8 | `loadTest()` double-fetch | Historical Android bug: `init {}` and the screen's `LaunchedEffect` both called `loadTest()`. The KMP port's `PPDTTestScreen` calls `loadTest(testId)` from a single `LaunchedEffect(testId)`; `PPDTTestViewModel` has no `init {}` load call. | ✅ Fixed, carried into KMP port |
| 9 | IMAGE_VIEWING timer flip race | Generation-token pattern (Section 5) prevents the dying 30 s timer's completion handler from clobbering the new 240 s timer's `isTimerActive`. | ✅ Fixed, carried into KMP port |
| 10 | Navigate-away shows error dialog | `PPDTSubmissionResultViewModel` re-throws `CancellationException` before its error-handling path (Section 13) — a navigate-away must not surface `uiState.error`. | ✅ Fixed, carried into KMP port |
| 11 | Duplicate `getPPDTResult` calls | Listener cancellation after `COMPLETED` (Section 13) — one result fetch per submission, guaranteed. | ✅ Fixed, carried into KMP port |
| 12 | In-memory gender filter (Room era) | Historical: the Room cache filtered by gender in-memory after fetching. `GitLivePPDTImageCacheManager` filters at the SQL layer natively — this class of bug can't recur post-migration. | ✅ Superseded by KMP migration |
| 13 | Cold-start Firestore version check (Room era) | Historical: Room's cache checked Firestore's version on every warm launch. `GitLivePPDTImageCacheManager`'s `STALENESS_TTL_HOURS = 24` gate (Section 6) is the direct successor. | ✅ Superseded by KMP migration |
| 14 | Image whitespace bands in IMAGE_VIEWING phase | `aspectRatio(4f / 3f)` + `ContentScale.Crop` carried into the KMP port (Section 6). | ✅ Fixed, carried into KMP port |
| 15 | **Stuck-ACTIVE `test_sessions` doc (2026-08-08)** | `SubmitPPDTTestUseCase` never completed the session on submit; no `pauseTest()`/`BackHandler` existed, so exiting left it `ACTIVE` forever, and the rules blocked retaking it ("Cloud connection required"). Fixed in `6a9a7c1c` (session completion/abandonment wiring); same fix landed for TAT/WAT/SRT/SDT in `c58f4793`. Full detail: Section 24. | ⚠️ Superseded by #16 |
| 16 | **`test_sessions` retake regression (2026-08-08→09)** | `4694e2d2` "fixed" a wrongly-diagnosed root cause and deleted the rule's only reclaim branch, permanently blocking retakes on any stuck-`ACTIVE` session (hit both OIR and PPDT). Fixed in `3a602506`; also added session-leak cleanup to PPDT/TAT/WAT/SRT/SDT load paths. Full detail + rule reasoning: Section 24. | ✅ Fixed |
| 17 | **Subscription usage doc-id mismatch (2026-08-09)** | `d6abd123` compared a `month` field to a differently-formatted doc id, permanently denying every user's first monthly usage write for every test type — surfaced as "Failed to submit test" on submissions that had already persisted (Section 8's fault-isolation note), and silently skipped OLQ analysis triggering. Fixed in `37df6f41`. Full detail: Section 24. | ✅ Fixed |
| 18 | **Rules-unit test cross-file interference** | Node's test runner parallelizes `*.rules.test.mjs` files by default; concurrent `clearFirestore()` calls against the shared emulator produced flaky failures. Fixed via `--test-concurrency=1` in `firestore-tests/package.json`. | ✅ Fixed |
| 19 | **Regression tripwire for `firestore-tests/`** | #16 and #17 both shipped invisibly because nothing forced review when coverage weakened. `REQUIRED_TESTS.txt` + `verify-required-tests.mjs` (npm's `pretest` hook) fails CI if a pinned test is deleted/renamed without a matching manifest edit. | ✅ Added |

---

## 23. Cache Invalidation Contract

**Rule: every batch content update MUST bump the Firestore `version` field.** This section describes the current SQLDelight-backed cache (`GitLivePPDTImageCacheManager`, Section 6) — the Room-era mechanics this section previously described (`CachedPPDTImageEntity`, `MIGRATION_21_22`, Room's per-open schema validation) no longer exist; that architecture was deleted in the KMP-convergence plan.

The cache is keyed by `batchId` (currently `batch_001`). The app serves cached images forever unless a version change is detected via the algorithm below.

### How version checking works

```
initialSync()
  ├─ local count < TARGET_CACHE_SIZE (15)?  → download immediately (no version check needed)
  └─ local count >= 15?                      → isCacheStale("batch_001")
        ├─ no local batch metadata row       → stale (first install / cleared cache)
        ├─ hoursSinceCheck < STALENESS_TTL_HOURS (24) → fresh, skip Firestore entirely (TTL gate)
        └─ TTL expired → fetch Firestore version field
              ├─ Firestore version == local version → fresh, record staleness-check timestamp
              ├─ Firestore version != local version → stale → clear table + re-download batch
              └─ Firestore fetch fails (network error) → treat as fresh (fail-safe, don't wipe)
```

`getImageForTest()` separately triggers `initialSync()` if the local count drops below `MIN_CACHE_SIZE` (5), independent of the staleness/TTL path above.

### Checklist before running step3_upload.py

When re-running the content pipeline to update images:

- [ ] **Bump the version** in `step3_upload.py`: change `"version": "2.0.0"` → `"3.0.0"` (or next)
- [ ] Confirm the new version propagates into the Firestore document after upload
- [ ] The app will auto-invalidate its cache on next test open — no app release needed

Failure to bump the version = app continues serving the old images regardless of what was uploaded.

### Tests that enforce this contract

`GitLivePPDTImageCacheManagerTest.kt` (`data-firebase`) is the current home for this coverage — gender-tag filtering never crosses genders, `getImageById` fails honestly for an unknown id, cache-status counts, `clearCache` empties the table. If TTL/staleness-specific regression tests (mirroring the Room-era suite's version-mismatch/TTL-skip/TTL-expiry cases) don't yet exist in this file, that's a gap worth closing rather than assuming coverage carried over automatically from the deleted Room tests.

---

## 18. Data Flow Diagram (End-to-End)

```
[StudentHomeScreen]
     │ tap PPDT
     ▼
[PPDTTestViewModel.loadTest()]
     ├─ [1] CheckTestEligibilityUseCase(TestType.PPDT, userId)
     │         ├─ LimitReached → isLimitReached=true → TestLimitReachedDialog → stop
     │         └─ NetworkError → typed TestError → stop
     └─ [2] LoadPPDTTestUseCase(userId, testId)
                 ├─ resolveGenderTag()          ← UserProfileRepository
                 │     ├─ profile null → ProfileIncompleteException → isProfileIncomplete=true → stop
                 │     ├─ MALE/FEMALE → gender-filtered image pool
                 │     └─ OTHER / error → full pool
                 ├─ TestSessionRepository.createTestSession(userId, testId, PPDT)  ← durable session doc, ACTIVE
                 └─ TestContentRepository.getPPDTQuestion(genderTag)
                           │
                   Cache hit (GitLivePPDTImageCacheManager, SQLDelight)?
                   ├─ YES: served from local cache
                   └─ NO : Firestore test_content/ppdt/image_batches/batch_001 → cache insert
     │
     │ imageUrl + session in UiState
     ▼
[PPDTImageViewingPhase] ──Coil AsyncImage──► Firebase Storage (HTTP cache)
     │ 30 s timer expires
     ▼
[PPDTWritingPhase] ──story text──► UiState
     │ submitTest()
     ▼
[SubmitPPDTTestUseCase]
     │
     ├──► SubmissionRepository.submitPPDT() ──► Firestore submissions/{id} (status: SUBMITTED_PENDING_REVIEW)
     ├──► TestUsageRecorder.recordTestUsage()
     └──► TestSessionRepository.completeTestSession(session.sessionId)  ← session doc → SUBMITTED
                    │
                    ▼ (back in PPDTTestViewModel, on use-case success)
     [SubmissionAnalysisTrigger.trigger(PPDT, submissionId)]
                    │
        Android: WorkManagerSubmissionAnalysisTrigger → enqueues PPDTAnalysisWorker
        iOS:     KtorSubmissionAnalysisTrigger → dispatches immediately in-foreground
                    │
                    ▼ (both platforms converge here)
        [PPDTAnalysisOrchestrator.analyze(submissionId)]  (shared)
                    ├─ [1] Fetch submission + verify PENDING_ANALYSIS
                    ├─ [2] Resolve candidateGender from UserProfile
                    ├─ [3] Fetch PPDTQuestion (imageUrl + imageContext)
                    ├─ [4] Download image bytes (best-effort, Ktor)
                    ├─ [5] generatePPDTMultimodalPrompt(story, imageContext, gender)
                    ├─ [6] KtorPPDTAnalyzer → gemini-2.5-flash, temp=0, 60s, 3 retries
                    ├─ [7] Validate 15 OLQ scores (SSB Factor II rules)
                    ├─ [8] Firestore batch write:
                    │       ppdt_results/{id}   ← full OLQAnalysisResult (with reasoning)
                    │       submissions/{id}    ← status COMPLETED
                    └─ [9] GetOLQDashboardUseCase.invalidateCache(userId) (+ Android push notification, from the Worker shell)
     │
     ▼
[PPDTSubmissionResultScreen]
     │ observePPDTSubmission() real-time listener
     ├─ analysisStatus == PENDING/ANALYZING: show loading
     └─ analysisStatus == COMPLETED:
           getPPDTResult(submissionId) ──► ppdt_results/{id}, then cancel listener
           Display OLQ scores, rating, strengths, weaknesses
           PPDTOLQReasoningCard: expandable per-OLQ reasoning text

[StudentHomeScreen → OLQDashboardCard]
     │ GetOLQDashboardUseCase (5-min cache, 6-s per-type timeout)
     └── Phase1Results.ppdtOLQResult ──► unified OLQ dashboard

[PPDTTestScreen exit path — X button OR hardware/predictive back]
     │ showExitDialog → confirm
     ▼
[PPDTTestViewModel.pauseTest()]
     └──► TestSessionRepository.abandonTestSession(session.sessionId)  ← session doc → ABANDONED
```

Writes to `test_sessions` and `users/{userId}/subscription/{month}` above are gated by `firestore.rules` (Section 24) — if a step here fails and the Kotlin looks correct, suspect the rule first (Section 25).

---

## 19. Gaps Fixed in Phases 1–8

All gaps listed below were confirmed by code analysis before the improvement phases and are now resolved. (Historical — file paths below reflect the pre-KMP `core/domain`/`app` layout at the time these fixes landed; see Sections 1–14 for current paths.)

| # | Gap | Fix | Phase |
|---|-----|-----|-------|
| 1 | `PPDTQuestion.context` was empty string; no per-picture rubric | Replaced with structured `PPDTImageContext`; 64 images uploaded with full context | 5 + 6 |
| 2 | Generic prompt — no per-picture rubric | `PPDTPrompts.generatePPDTMultimodalPrompt()` injects coreElements, penalizedThemes, primaryOLQs, deviationTolerance | 8 |
| 3 | `candidateGender` hardcoded to `"male"` | Analysis resolves from `UserProfileRepository.getUserProfile(userId).gender` | 2 |
| 4 | Gemini temperature not set (default ~0.7–1.0) → score drift | `temperature = 0.0` default in `KtorGeminiClient.generateContent` | 1 |
| 5 | `batch_001` used 57 placeholder images | 64 Gemini-generated images extracted, gender-classified, context-enriched, and uploaded | 5 |
| 6 | `minCharacters` inconsistency (domain=50, UI=200) | `PPDTQuestion.minCharacters` updated to 200 | 1 |
| 7 | `OLQScore.reasoning` never shown in UI | `PPDTOLQReasoningCard` renders per-OLQ reasoning in result screen | 4 |
| 8 | No gender-based image routing | Profile gate + `GenderTag` filter on image pool | 3 + 6 |

**Remaining (not part of Phases 1–8):** Repeat-picture deduplication beyond least-used count rotation — no anti-gaming logic for frequent users.

---

## 20. Phase Implementation History

| Phase | What | Commit | Status |
|-------|------|--------|--------|
| 1 | Deterministic scoring (TEMPERATURE=0) + minCharacters=200 | `42a6c97` | ✅ Done |
| 2 | Gender from UserProfile in analysis worker | `308ca41` | ✅ Done |
| 3 | Profile gate + gender-based image routing | `b778275` | ✅ Done |
| 4 | OLQ reasoning in result screen (PPDTOLQReasoningCard) | `e9fc1e6` | ✅ Done |
| 5 | Image replacement pipeline (Python: extract → context → upload) | `768c3d6` | ✅ Done |
| 6 | PPDTImageContext + GenderTag domain model + Room migration 21→22 | `2abf352` | ✅ Done |
| 7 | Multimodal Gemini service (analyzePPDTMultimodal) | `1f49069` | ✅ Done |
| 8 | Multimodal prompt rubric + worker image-aware analysis | `68c18f1` | ✅ Done |

**Bug-fix + cache improvement pass (pre-KMP, June 2026)** — surfaced from logcat analysis after Phase 8:

| Fix | What | Commits | Status |
|-----|------|---------|--------|
| Bug 1 | Remove `loadTest()` from `init {}` — double-fetch on startup | `f4c8808` | ✅ Done |
| Bug 2 | Timer generation token — prevents completion-handler race on phase transition | `07ac86a` | ✅ Done |
| Bug 3 | Re-throw `CancellationException` in result ViewModel — no false error on navigate-away | `b6f3b97` | ✅ Done |
| Bug 4 | Cancel Firestore listener after `COMPLETED` — no duplicate `getPPDTResult` calls | `b6f3b97` | ✅ Done |
| Cache A | Gender filter pushed to SQL layer — eliminates in-memory filtering | `f4c8808` | ✅ Done |
| Cache B | 24h TTL staleness gate | `9828980` | ✅ Done |
| UI | `aspectRatio(4f/3f)` + `ContentScale.Crop` — no whitespace bands | `07ac86a` | ✅ Done |
| Refactor | `LoadPPDTTestUseCase` + `SubmitPPDTTestUseCase` — extract domain use cases from ViewModel | `197a949` | ✅ Done |

**KMP-convergence + session-lifecycle pass (2026-08-08):**

| Fix | What | Commit | Status |
|-----|------|--------|--------|
| Migration | Android-only architecture (Room cache, `SubscriptionManager`, `WorkManager`-direct, `TestNavigationEvent`, `core/domain`) ported/absorbed into `shared`; `GitLivePPDTImageCacheManager` (SQLDelight) replaces Room; `CheckTestEligibilityUseCase`/`SubmissionAnalysisTrigger` replace the old Android-only seams | KMP-convergence plan (multiple) | ✅ Done |
| Bug | Stuck-ACTIVE `test_sessions` doc — `SubmitPPDTTestUseCase` never completed the session, `PPDTTestViewModel` had no `pauseTest()`, no `BackHandler` on the screen (Section 17, #15) | `6a9a7c1c` | ⚠️ Superseded by next row |
| CI | `firestore-tests/` rules-unit-testing suite added, guarding `test_sessions`' update rule against a repeat regression | `c58f4793` | ✅ Done |

**Firestore rules incident pass (2026-08-09)** — full detail in Section 17 #16–#19 and Section 24:

| Fix | What | Commit | Status |
|-----|------|--------|--------|
| Bug | `test_sessions` retake regression + session-leak cleanup (PPDT/TAT/WAT/SRT/SDT) | `4694e2d2` → `3a602506` | ✅ Fixed |
| Bug | Subscription usage doc-id mismatch, blocked all test submissions' usage recording | `d6abd123` → `37df6f41` | ✅ Fixed |
| Process | Rules-test CI fixes + tripwire (`REQUIRED_TESTS.txt`) + Sections 24/25 added to this doc | `37df6f41` | ✅ Done |

---

## 21. OLQ Coverage Matrix — 50-Picture Bank Design

**Rule:** Design the matrix BEFORE generating or commissioning pictures. Each OLQ must appear as a "primary OLQ" in at least 4–6 pictures.

| Category | Count | Primary OLQs |
|----------|-------|-------------|
| Rescue / Emergency | 8 | COURAGE, INITIATIVE, SPEED_OF_DECISION |
| Leadership / Group Planning | 10 | INFLUENCE_GROUP, ORGANIZING_ABILITY, SPEED_OF_DECISION |
| Community / Social Service | 8 | COOPERATION, SENSE_OF_RESPONSIBILITY, SOCIAL_ADJUSTMENT |
| Individual Adversity / Persistence | 7 | DETERMINATION, STAMINA, SELF_CONFIDENCE |
| Conflict / Communication | 7 | POWER_OF_EXPRESSION, SOCIAL_ADJUSTMENT, COOPERATION |
| Problem Solving / Analysis | 6 | EFFECTIVE_INTELLIGENCE, REASONING_ABILITY |
| Team Energy / Motivation | 4 | LIVELINESS, COOPERATION, INITIATIVE |
| **Total** | **50** | All 15 OLQs covered |

**OLQ frequency check (minimum 4 pictures each):**

| OLQ | Appears in categories | Min pictures |
|-----|-----------------------|-------------|
| EFFECTIVE_INTELLIGENCE | Problem Solving | 6 |
| REASONING_ABILITY | Problem Solving | 6 |
| ORGANIZING_ABILITY | Leadership | 10 |
| POWER_OF_EXPRESSION | Conflict/Comm | 7 |
| SOCIAL_ADJUSTMENT | Community, Conflict | 15 |
| COOPERATION | Community, Team | 12 |
| SENSE_OF_RESPONSIBILITY | Community | 8 |
| INITIATIVE | Rescue, Team | 12 |
| SELF_CONFIDENCE | Adversity | 7 |
| SPEED_OF_DECISION | Rescue, Leadership | 18 |
| INFLUENCE_GROUP | Leadership | 10 |
| LIVELINESS | Team | 4 |
| DETERMINATION | Adversity | 7 |
| COURAGE | Rescue | 8 |
| STAMINA | Adversity | 7 |

---

## 22. Picture Creation Pipeline

### Design principles
- **B&W photograph style** — photo-realistic images of real human figures in real settings (NOT pencil sketches). Think staged black-and-white photographs.
- **PPDT vs TAT difference:** PPDT pictures are made hazy/blurry intentionally; TAT pictures are relatively clear. Same base image type, different post-processing.
- **Low resolution + grainy** — Gaussian noise + slight blur applied over the base image. Not HD; deliberately hard to see clearly at a glance.
- **Human figures present** — 1 to 6 people in realistic settings (office, outdoor, group meeting, etc.); no abstract or single-object images
- **No text or labels** in the image
- **Ambiguous but recognizable** — candidate can identify the core scene and characters but fine details are debatable

### Image style reference
The SSB PPDT picture style (from actual SSB centres):
- Black and white base image (monochrome)
- Photo-realistic human figures — real people, real environments
- Grainy texture overlaid (film grain / noise)
- Slightly reduced contrast — mid-tones flattened
- PPDT: additional haze/blur layer (Gaussian blur ~2–4px radius)
- TAT: same style but WITHOUT the haze layer — figures are clearly visible

### Image generation / sourcing approach
Option A (recommended): Commission or photograph staged B&W scenes matching each OLQ category intent, then post-process (desaturate + add grain + blur for PPDT).

Option B: Use AI image generation (Midjourney/DALL-E) with realistic style, then apply B&W + grain + blur in post-processing:
```
Prompt template: "black and white photograph, realistic human figures, [SCENE INTENT],
[NUMBER] people, indoor/outdoor setting, 1960s documentary style, grainy film texture,
no text, monochrome"
```
Then apply in ImageMagick/Pillow:
```bash
# PPDT post-processing (hazy)
convert input.jpg -colorspace Gray -noise 8 -blur 0x2 -contrast-stretch 2%x2% output_ppdt.jpg

# TAT post-processing (clear)
convert input.jpg -colorspace Gray -noise 4 output_tat.jpg
```

### Validation checklist (per picture, before upload)
- [ ] Core scene is recognizable even at 30% opacity
- [ ] At least 1–2 core elements are clearly visible
- [ ] Does NOT suggest a single "correct" story — multiple valid interpretations exist
- [ ] Ambiguous peripheral elements (good for creative deviation)
- [ ] No culturally insensitive, violent, or inappropriate content
- [ ] Matches the intended OLQ category from the matrix (Section 21)
- [ ] Aspect ratio consistent across the batch (~4:3)
- [ ] `genderTag` assigned and verified in `gender_map.json` before upload
- [ ] `PPDTImageContext` reviewed in `preview.html` before `step3_upload.py` runs

---

## 24. Firestore Security Rules Governing PPDT

Every incident in Section 17 #15–#17 originated here, not in `shared`/`data-firebase` Kotlin: a rule that *adds* a restriction fails silently and permanently for every request that hits it, with no exception anywhere in the write path's own code — just `PERMISSION_DENIED` from the SDK, with no indication of which clause denied it. If a PPDT failure doesn't trace to any Kotlin call site, suspect this file next (Section 25 is the diagnostic method).

Full ruleset: `/firestore.rules`. Rules-unit tests: `/firestore-tests/` (Section 15).

### `test_sessions/{sessionId}` — gates session lifecycle AND question access

```
match /test_sessions/{sessionId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;

  allow create: if isAuthenticated() &&
                   request.resource.id == request.auth.uid + '_' + request.resource.data.testId &&
                   request.resource.data.userId == request.auth.uid &&
                   request.resource.data.isActive == true &&
                   request.resource.data.status == 'ACTIVE';

  allow update: if isAuthenticated() &&
                   resource.data.userId == request.auth.uid &&
                   request.resource.data.userId == resource.data.userId &&
                   request.resource.data.testId == resource.data.testId &&
                   request.resource.data.testType == resource.data.testType &&
                   (
                     // transition 1: ACTIVE → terminal (submit / abandon / expire)
                     (resource.data.status == 'ACTIVE' &&
                      request.resource.data.isActive == false &&
                      request.resource.data.status in ['ABANDONED', 'SUBMITTED', 'EXPIRED'] &&
                      request.resource.data.startTime == resource.data.startTime &&
                      request.resource.data.expiresAt == resource.data.expiresAt) ||
                     // transition 2: owner restarts, from ANY prior status — including still-ACTIVE
                     (request.resource.data.isActive == true &&
                      request.resource.data.status == 'ACTIVE')
                   );

  allow delete: if false;   // audit trail — sessions are never deleted, only transitioned
}
```

**Why transition 2 allows `ACTIVE → ACTIVE`, not just terminal/expired → `ACTIVE`** (the crux of #15/#16): a session doc can get stuck `ACTIVE` well before its 2-hour `expiresAt` any time an exit path fails to write a terminal state — process death, a question-load failure, a crash. Requiring the prior session to be terminal/expired before allowing a restart buys no security (the owner already holds that session and everything it grants) — it only guarantees the owner gets locked out for up to two hours the first time a terminal write fails. **Don't reintroduce a terminal/expired-only guard here** — it has already shipped twice (#15, #16).

**Why there's no `startTime`/`expiresAt` vs. `request.time.toMillis()` comparison:** they're client-clock values for the countdown UI, not a security boundary — a device clock running ahead of the server's would spuriously deny a legitimate write. Ownership + `userId`/`testId`/`testType` immutability + the status whitelist are the actual guard.

**Shared with OIR:** `test_questions/{testId}`'s read rule requires an `ACTIVE`, non-expired session doc in this same collection. PPDT doesn't read from `test_questions` (its images come from `test_content/ppdt/...`, Section 6), so this dependency is OIR-specific, not PPDT's.

### `submissions/{submissionId}` — PPDT's create path

Relevant slice of the multi-test-type rule: `userId == request.auth.uid`; `keys().hasAll(['testType', 'submittedAt'])`; one of `responses`/`data`/`resultId` present (PPDT writes `data`). The rule's OIR-specific `test_sessions` existence check does **not** apply to PPDT (`testType != 'OIR'` short-circuits it) — PPDT's `submissions` write has never been implicated in #15/#16.

### `users/{userId}/subscription/{document}` — the site of Section 17 #17

```
match /subscription/{document} {
  allow read: if isOwner(userId);

  allow create: if isOwner(userId) &&
                  request.resource.data.userId == userId &&
                  request.resource.data.keys().hasAll([...]) &&
                  document == 'usage_' + request.resource.data.month &&   // ← was `== document`, see Section 17 #17
                  ... // count bounds 0–10, list/int type checks

  allow update: if isOwner(userId) &&
                   request.resource.data.userId == resource.data.userId &&
                   request.resource.data.month == resource.data.month &&
                   ... // exactly-one-increment guard on every counter + recordedSubmissionIds

  allow delete: if false;
}
```

`GitLiveTestUsageRecorder.recordTestUsage()` is the only writer, called from step 4 of Section 8's flow. Doc id is `usage_{yyyy-MM}`; the `month` **field** stored inside the doc is the bare `{yyyy-MM}` value (`getMonthlyUsage()` reads it back for display). **Any future rule change that compares `month` to `document` directly, instead of reconstructing `'usage_' + month`, reintroduces #17.** Generic trap, not PPDT-specific: wherever a wildcard path segment encodes a derived form of a field the doc also stores, compare by reconstruction, not direct equality.

**Superseded by Phase 5 (docs/plans/CrossPlatform_SSOT):** the `create`/`update` rules quoted above no longer exist — `firestore.rules` now reads `allow read: if isOwner(userId); allow write: if false;` for this path. `GitLiveTestUsageRecorder.recordTestUsage()` calls the `recordTestUsage` Cloud Function (Admin SDK, bypasses rules) instead of writing the doc directly, so the reconstruction trap above can no longer recur in *client* rules — but the same reconstruction (`'usage_' + month`, not `document`) still applies inside `functions/src/eligibility.js`, which now owns this doc id shape.

A rule that *adds* a restriction is the highest-risk change in this codebase — see Section 25 for why and how to verify one safely before it ships.

---

## 25. Debugging Playbook: PPDT Submission / Session Failures

Use for "Failed to submit test," "Cloud connection required," "Could not create a secure test session," or anything bottoming out in `FirebaseFirestoreException: PERMISSION_DENIED`. Generalizes to any test type sharing `TestSessionRepository`/`TestUsageRecorder`.

### Step 0 — read Firestore directly; don't trust the client's error alone

The error describes the *last failing write* inside one `runCatching` block — not whether earlier writes in the same use case already succeeded (Section 8).

```bash
adb logcat -v time | grep -E "PPDTTestViewModel|PERMISSION_DENIED|Write failed at"

TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <project>" \
  "https://firestore.googleapis.com/v1/projects/<project>/databases/(default)/documents/<path>"
```

Check: does `submissions/{submissionId}` exist (id from logs, or query by `userId`+`testType`)? What's `test_sessions/{userId}_{testId}`'s `status`? Does `users/{userId}/subscription/usage_{yyyy-MM}` exist for the current month?

### Step 1 — isolate which write actually failed

| `submissions/{id}` exists? | `test_sessions` status | `usage_{month}` incremented? | Failing step |
|---|---|---|---|
| No | unchanged | — | Step 3, the submission write itself. Rare — check `submissions`' create rule. |
| Yes | still `ACTIVE` | no | Step 4, `recordTestUsage` — check `subscription/{document}`'s rules (Section 24). #17's shape. |
| Yes | still `ACTIVE` | yes | Step 5, `completeTestSession` — check `test_sessions`' update rule (Section 24). #15/#16's shape. |
| Yes | `SUBMITTED` | yes | Nothing failed server-side — bug is in Kotlin, not rules. |

### Step 2 — reproduce in the emulator before touching production

Don't hand-edit `firestore.rules` and redeploy to test a theory — #16 shipped from exactly that shortcut.

```bash
firebase emulators:exec --only firestore --project demo-ssbmax-rules-test \
  "npm --prefix firestore-tests test"
# or against an already-running emulator:
RULES_TEST_PROJECT_ID=<project> npm --prefix firestore-tests test
```

Write a test using the **real** write shape (field names, doc id, value types — read from the repository source, don't guess) and confirm it fails against the current rule first.

### Step 3 — fix, prove it with the same test, deploy, verify what's live

```bash
git stash push firestore.rules -m "verify repro"
npm --prefix firestore-tests test        # confirm the new test fails against the OLD rule
git stash pop
npm --prefix firestore-tests test        # confirm it now passes, nothing else regressed
firebase deploy --only firestore:rules --project <project>

# confirm the deployed ruleset actually matches the local file:
TOKEN=$(gcloud auth print-access-token)
RS=$(curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <project>" \
  "https://firebaserules.googleapis.com/v1/projects/<project>/releases/cloud.firestore" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['rulesetName'])")
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <project>" \
  "https://firebaserules.googleapis.com/v1/$RS" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['source']['files'][0]['content'])" \
  > /tmp/deployed.rules
diff /tmp/deployed.rules firestore.rules && echo "MATCH"
```

### Step 4 — verify on a real device

The emulator proves the rule is logically correct, not that the real SDK/auth/network path actually exercises it as expected. Reproduce the original action on-device (`adb logcat` running); confirm no new `PERMISSION_DENIED` and Firestore docs reach their expected terminal state.

**Don't trust a commit message's "verified" claim over a failing test.** #15 and #16 both shipped with sincere, real manual verification described in their commit messages — neither was pinned by a test that outlived the session that wrote it. Treat any rules fix, including this playbook's own future applications, as unverified until a checked-in `firestore-tests/*.rules.test.mjs` test fails on the old rule and passes on the new one.
