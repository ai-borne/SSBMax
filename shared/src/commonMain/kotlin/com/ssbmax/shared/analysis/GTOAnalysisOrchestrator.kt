package com.ssbmax.shared.analysis

import com.ssbmax.shared.ai.prompts.GTOAnalysisPrompts
import com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.domain.repository.FeatureFlagRepository
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.scoring.EntryType
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.service.EvaluationFunctionsClient
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.validation.ValidationIntegration

/**
 * KMP port of `app`'s `GTOAnalysisWorker`. Matches the original's resilience behavior:
 * on AI failure after retries, writes neutral fallback scores rather than marking FAILED
 * (GTO has no dedicated failure UI state the way PPDT/WAT/SRT/SD do -- see the original's
 * `generateFallbackOLQScores` comment). This legacy behavior only applies to the
 * client-side path below -- the new server-side path (Phase 8 Ship, Web SSB Test Flow
 * Parity plan) marks FAILED on repeated Gemini failure instead, matching every other
 * `evaluate*` Cloud Function's contract; see `functions/src/evaluation/gtoEvaluate.js`'s
 * class doc.
 *
 * [FEATURE_FLAG_SERVER_EVALUATION] gates the new path, default off. It only ever fires
 * for GD/GPE/Lecturette: `gtoRepository.getSubmission` can't return any other
 * `GTOSubmission` variant today (`GitLiveGTOSubmissionDelegate.kt::parseGtoSubmissionTestType`
 * has no dead-code branches for PGT/HGT/GOR/CT/IO), so no extra type check is needed here
 * -- `evaluateGTO`'s own `GTO_SUBTYPE_CONFIG` guard is defense in depth, not the only guard.
 */
class GTOAnalysisOrchestrator(
    private val gtoRepository: GTORepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val logger: DomainLogger,
    private val featureFlagRepository: FeatureFlagRepository,
    private val evaluationFunctionsClient: EvaluationFunctionsClient
) {
    suspend fun analyze(submissionId: String) {
        val submission = gtoRepository.getSubmission(submissionId).getOrNull() ?: run {
            logger.e(TAG, "GTO submission not found: $submissionId")
            return
        }
        if (submission.status != GTOSubmissionStatus.PENDING_ANALYSIS) return

        if (featureFlagRepository.getFeatureFlags().isEnabled(FEATURE_FLAG_SERVER_EVALUATION)) {
            evaluationFunctionsClient.evaluateGTO(submissionId).onFailure {
                logger.e(TAG, "Server-side GTO evaluation failed: $submissionId: ${it.message}")
            }
            return
        }

        gtoRepository.updateSubmissionStatus(submissionId, GTOSubmissionStatus.ANALYZING)

        val prompt = GTOAnalysisPrompts.generateAnalysisPrompt(submission)
        val olqScores = AnalysisRetry.withRetry(scoreRange = 1..10) {
            aiService.analyzeGTOResponse(prompt, submission.testType)
        }

        val finalScores = if (olqScores != null) {
            ValidationIntegration.validateScores(olqScores, EntryType.NDA)
            olqScores
        } else {
            logger.w(TAG, "GTO AI analysis failed after retries, using fallback scores: $submissionId")
            fallbackOLQScores()
        }

        val updateResult = gtoRepository.updateSubmissionOLQScores(submissionId, finalScores)
        if (updateResult.isFailure) {
            logger.e(TAG, "Failed to save GTO OLQ scores: $submissionId")
            gtoRepository.updateSubmissionStatus(submissionId, GTOSubmissionStatus.FAILED)
            return
        }

        runCatching { getOLQDashboard.invalidateCache(submission.userId) }
            .onFailure { logger.w(TAG, "Failed to invalidate dashboard cache: ${it.message}") }
    }

    private fun fallbackOLQScores(): Map<OLQ, OLQScore> = OLQ.entries.associateWith { olq ->
        OLQScore(
            score = 6,
            confidence = FALLBACK_CONFIDENCE,
            reasoning = "AI analysis unavailable - neutral score assigned. Please retake test for accurate assessment."
        )
    }

    private companion object {
        const val TAG = "GTOAnalysisOrchestrator"
        const val FALLBACK_CONFIDENCE = 30
        const val FEATURE_FLAG_SERVER_EVALUATION = "gto_server_evaluation"
    }
}
