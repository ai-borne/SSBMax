package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.PPDTRating
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.FeatureFlagRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.scoring.ScoringUtils
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.service.EvaluationFunctionsClient
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.validation.ValidationIntegration
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.coroutines.flow.first
import kotlin.time.Clock

/**
 * KMP port of `app`'s `PPDTAnalysisWorker`, minus WorkManager (this runs immediately in
 * the caller's coroutine, see [KtorSubmissionAnalysisTrigger]) and minus the Android push
 * notification step (see that class's doc for why). Same fetch -> ANALYZING -> retrieve
 * question/image -> AI analyze (3x retry) -> SSB-validate -> write OLQ result -> invalidate
 * dashboard cache shape as the original.
 *
 * [FEATURE_FLAG_SERVER_EVALUATION] gates the new server-side path (Phase 9 Ship, Web SSB
 * Test Flow Parity plan), default off. When enabled, this delegates entirely to
 * `functions/src/evaluation/ppdtEvaluate.js` via [evaluationFunctionsClient] -- the
 * function resolves the picture image itself (SSRF-guarded, never trusting a URL off the
 * submission doc), does its own ANALYZING/COMPLETED/FAILED flips and result write, so
 * nothing further happens here; the caller's existing Firestore submission listener
 * observes the result reactively either way. Both paths stay live simultaneously during
 * the canary/bake period -- legacy code (this class's own image-download + AI-analysis
 * path) is only deleted in PPDT's Cutover phase. PPDT is production-verified today, so
 * per the plan's Verification section a synthetic-fixture parity harness must run before
 * this flag exceeds a 5% canary.
 */
class PPDTAnalysisOrchestrator(
    private val submissionRepository: SubmissionRepository,
    private val testContentRepository: TestContentRepository,
    private val userProfileRepository: UserProfileRepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val httpClient: HttpClient,
    private val logger: DomainLogger,
    private val featureFlagRepository: FeatureFlagRepository,
    private val evaluationFunctionsClient: EvaluationFunctionsClient
) {
    suspend fun analyze(submissionId: String) {
        val submission = submissionRepository.getPPDTSubmission(submissionId).getOrNull() ?: run {
            logger.e(TAG, "PPDT submission not found: $submissionId")
            return
        }
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return

        if (featureFlagRepository.getFeatureFlags().isEnabled(FEATURE_FLAG_SERVER_EVALUATION)) {
            evaluationFunctionsClient.evaluatePPDT(submissionId).onFailure {
                logger.e(TAG, "Server-side PPDT evaluation failed: $submissionId: ${it.message}")
            }
            return
        }

        submissionRepository.updatePPDTAnalysisStatus(submissionId, AnalysisStatus.ANALYZING)
            .onFailure {
                logger.e(TAG, "Failed to mark PPDT submission ANALYZING: $submissionId: ${it.message}")
                return
            }

        val userProfile = runCatching { userProfileRepository.getUserProfile(submission.userId).first().getOrNull() }
            .getOrNull()
        val candidateGender = userProfile?.gender?.displayName ?: "Unknown"
        val entryType = ScoringUtils.toScoringEntryType(userProfile?.entryType)

        val ppdtQuestion = testContentRepository.getPPDTQuestion(submission.questionId).getOrNull()
        val imageBytes = ppdtQuestion?.imageUrl
            ?.takeIf { it.isNotBlank() }
            ?.let { downloadImageBytes(it) }
            ?: ByteArray(0)
        val imageContext = ppdtQuestion?.imageContext ?: PPDTImageContext()

        val olqScores = AnalysisRetry.withRetry {
            aiService.analyzePPDTMultimodal(imageBytes, submission.story, imageContext, candidateGender)
        }
        if (olqScores == null) {
            logger.e(TAG, "PPDT AI analysis failed after retries: $submissionId")
            submissionRepository.updatePPDTAnalysisStatus(submissionId, AnalysisStatus.FAILED)
            return
        }

        val validationResult = ValidationIntegration.validateScores(olqScores, entryType)
        logger.d(TAG, "SSB validation for $submissionId: ${validationResult.recommendation}")

        val overallScore = olqScores.values.map { it.score }.average().toFloat()
        val strengths = olqScores.entries.sortedBy { it.value.score }.take(3)
            .map { "${it.key.displayName} (${it.value.score})" }
        val weaknesses = olqScores.entries.sortedByDescending { it.value.score }.take(3)
            .map { "${it.key.displayName} (${it.value.score})" }

        val olqResult = OLQAnalysisResult(
            submissionId = submissionId,
            testType = TestType.PPDT,
            olqScores = olqScores,
            overallScore = overallScore,
            overallRating = PPDTRating.fromScore(overallScore).displayKey,
            strengths = strengths,
            weaknesses = weaknesses,
            recommendations = listOf(
                "Continue practicing PPDT with diverse scenarios",
                "Focus on strengthening: ${weaknesses.joinToString(", ")}",
                "Maintain clear and positive storytelling"
            ),
            analyzedAt = Clock.System.now().toEpochMilliseconds(),
            aiConfidence = olqScores.values.firstOrNull()?.confidence ?: 50
        )

        submissionRepository.updatePPDTOLQResult(submissionId, olqResult)
            .onFailure {
                logger.e(TAG, "Failed to persist PPDT OLQ result: $submissionId: ${it.message}")
                submissionRepository.updatePPDTAnalysisStatus(submissionId, AnalysisStatus.FAILED)
                return
            }
        runCatching { getOLQDashboard.invalidateCache(submission.userId) }
            .onFailure { logger.w(TAG, "Failed to invalidate dashboard cache: ${it.message}") }
    }

    private suspend fun downloadImageBytes(imageUrl: String): ByteArray = try {
        httpClient.get(imageUrl).body()
    } catch (e: Exception) {
        logger.w(TAG, "PPDT image download failed, proceeding with empty bytes: ${e.message}")
        ByteArray(0)
    }

    private companion object {
        const val TAG = "PPDTAnalysisOrchestrator"
        const val FEATURE_FLAG_SERVER_EVALUATION = "ppdt_server_evaluation"
    }
}
