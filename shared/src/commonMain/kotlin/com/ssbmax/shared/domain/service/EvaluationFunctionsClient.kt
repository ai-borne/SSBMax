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
}
