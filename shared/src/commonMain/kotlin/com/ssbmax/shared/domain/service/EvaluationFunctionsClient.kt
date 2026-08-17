package com.ssbmax.shared.domain.service

/**
 * Domain interface for the Tier-2 evaluation Cloud Functions
 * (`functions/src/evaluation/{type}Evaluate.js`), the centralized-evaluation SSOT both
 * KMP and web call (Web SSB Test Flow Parity plan, root `CLAUDE.md`'s Tier 2 architecture).
 *
 * Each `evaluate*` function performs the entire analysis (fetch submission, ownership
 * + quota check, Gemini call + retry, SSB validation, result write, status flip) itself
 * server-side -- callers here only need to invoke it and let the caller's existing
 * Firestore submission listener (e.g. `WATSubmissionResultViewModel`'s
 * `observeWATSubmission` flow) pick up the write reactively. `Result<Unit>` rather than
 * a parsed result type: nothing in this call's return value is consumed today.
 *
 * Each per-type orchestrator (`WATAnalysisOrchestrator` etc., Phase 4+ of the plan)
 * calls its matching method here instead of the legacy client-side AI path when its
 * feature flag (see `com.ssbmax.shared.domain.repository.FeatureFlagRepository`) is
 * enabled.
 *
 * Implemented by [com.ssbmax.shared.data.service.GitLiveEvaluationFunctionsClient].
 */
interface EvaluationFunctionsClient {
    suspend fun evaluateWAT(submissionId: String): Result<Unit>
    suspend fun evaluateSRT(submissionId: String): Result<Unit>
    suspend fun evaluateSD(submissionId: String): Result<Unit>

    /**
     * Interview keeps its per-response (not per-submission) evaluation shape (Phase 7,
     * Web SSB Test Flow Parity plan) -- [responseId] is the `interview_responses/{id}`
     * doc to evaluate, [sessionId] is its parent `interview_sessions/{id}`, used by
     * `evaluateInterviewResponse`'s ownership check.
     */
    suspend fun evaluateInterviewResponse(responseId: String, sessionId: String): Result<Unit>

    /**
     * GTO evaluation (Phase 8, Web SSB Test Flow Parity plan). Covers GD/GPE/Lecturette
     * only, not all `GTOSubmission` variants -- `functions/src/evaluation/gtoEvaluate.js`
     * rejects any other testType. This matches what `GTOAnalysisOrchestrator.kt` can
     * ever actually call it for: `GitLiveGTOSubmissionDelegate.kt::parseGtoSubmissionTestType`
     * already can't read back PGT/HGT/GOR/CT/IO submissions from Firestore, so
     * `gtoRepository.getSubmission` never returns one of those in the first place.
     */
    suspend fun evaluateGTO(submissionId: String): Result<Unit>

    /**
     * PPDT evaluation (Phase 9, Web SSB Test Flow Parity plan) -- the first image-based
     * (multimodal) `evaluate*` function. `functions/src/evaluation/ppdtEvaluate.js`
     * resolves the story's picture server-side from the submission's `questionId`/
     * `batchId` (SSRF guard, §A of the plan); this call only ever sends `submissionId`.
     */
    suspend fun evaluatePPDT(submissionId: String): Result<Unit>

    /**
     * TAT evaluation (Phase 10, Web SSB Test Flow Parity plan) -- last and highest-risk
     * type migrated. `functions/src/evaluation/tatEvaluate.js` resolves every story's
     * picture server-side from the submission's `batchId` against the `test_content/tat/
     * image_batches` doc (SSRF guard, §A of the plan, same as PPDT/GTO) and runs the 12
     * per-story Gemini calls with a bounded concurrency cap before running synthesis once
     * -- this call only ever sends `submissionId`.
     */
    suspend fun evaluateTAT(submissionId: String): Result<Unit>

    /**
     * Fires the same `notifications/{id}` "your result is ready" doc + push that
     * `evaluate*` functions above trigger automatically via `core.js`'s `notifyEvaluationComplete`
     * -- for legacy client-side-graded paths that finish grading entirely on-device and never call
     * any `evaluate*` function, so nothing server-side would otherwise fire it. Currently only
     * `TATSynthesisWorker` (Android's TAT WorkManager chain, kept deliberately separate from
     * [evaluateTAT]'s server path for process-death resilience -- see `app/CLAUDE.md`) calls this,
     * right after it finalizes a submission's result locally. `functions/src/notifications/
     * notifyGradingComplete.js` re-derives `testType` from the submission doc itself and checks
     * ownership -- this is the one call in this interface a client can invoke against data the
     * server doesn't already trust, so it needs that check where the others don't.
     */
    suspend fun notifyGradingComplete(submissionId: String): Result<Unit>
}
