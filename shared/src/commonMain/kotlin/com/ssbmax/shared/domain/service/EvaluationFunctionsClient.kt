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
}
