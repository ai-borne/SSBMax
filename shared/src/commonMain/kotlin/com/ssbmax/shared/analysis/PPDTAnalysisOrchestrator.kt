package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.PPDTRating
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.scoring.ScoringUtils
import com.ssbmax.shared.domain.service.AIService
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
 */
class PPDTAnalysisOrchestrator(
    private val submissionRepository: SubmissionRepository,
    private val testContentRepository: TestContentRepository,
    private val userProfileRepository: UserProfileRepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val httpClient: HttpClient,
    private val logger: DomainLogger
) {
    suspend fun analyze(submissionId: String) {
        val submission = submissionRepository.getPPDTSubmission(submissionId).getOrNull() ?: run {
            logger.e(TAG, "PPDT submission not found: $submissionId")
            return
        }
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return

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
    }
}
