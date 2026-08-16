package com.ssbmax.shared.analysis

import com.ssbmax.shared.ai.prompts.TATSynthesisPrompts
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.model.TATStoryAssessment
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
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
import kotlinx.serialization.json.Json

/**
 * KMP port of `app`'s `TATAnalysisPipelineOrchestrator` + `TATStoryAnalysisWorker` +
 * `TATSynthesisWorker`, collapsed into one sequential pipeline. The Android original
 * splits per-story analysis and synthesis into a WorkManager chain of independent
 * workers (each can be killed/retried by the OS separately) backed by a Room cache; here
 * the whole thing runs in one continuous coroutine (see [KtorSubmissionAnalysisTrigger]),
 * so per-story results are just a local list -- no cross-invocation cache needed, and no
 * WorkManager batching/backoff between stories (12 sequential Gemini calls; acceptable
 * for a foreground-triggered analysis run rather than an OS-scheduled background chain).
 *
 * [FEATURE_FLAG_SERVER_EVALUATION] gates the new server-side path (Phase 10 Ship, Web SSB
 * Test Flow Parity plan), default off. When enabled, this delegates entirely to
 * `functions/src/evaluation/tatEvaluate.js` via [evaluationFunctionsClient] -- the
 * function resolves every story's picture itself (SSRF-guarded, same
 * `test_content/tat/image_batches` doc, never trusting a URL off the submission doc),
 * runs the 12 per-story calls with a bounded concurrency cap, then synthesis, and does
 * its own ANALYZING/COMPLETED/FAILED flips and result write, so nothing further happens
 * here; the caller's existing Firestore submission listener observes the result
 * reactively either way. Both paths stay live simultaneously during the canary/bake
 * period -- legacy code (this class's own per-story download + AI-analysis + synthesis
 * path) is only deleted in TAT's Cutover phase, the last legacy deletion of the whole
 * plan. TAT is production-verified today and the highest-risk/last-migrated type per the
 * plan's risk ordering, so per the plan's Verification section a synthetic-fixture
 * parity harness must run before this flag exceeds a 5% canary.
 */
class TATAnalysisOrchestrator(
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
        val submission = submissionRepository.getTATSubmission(submissionId).getOrNull() ?: run {
            logger.e(TAG, "TAT submission not found: $submissionId")
            return
        }
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return
        if (submission.stories.isEmpty()) return

        if (featureFlagRepository.getFeatureFlags().isEnabled(FEATURE_FLAG_SERVER_EVALUATION)) {
            evaluationFunctionsClient.evaluateTAT(submissionId).onFailure {
                logger.e(TAG, "Server-side TAT evaluation failed: $submissionId: ${it.message}")
            }
            return
        }

        submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.ANALYZING)
            .onFailure {
                logger.e(TAG, "Failed to mark TAT submission ANALYZING: $submissionId: ${it.message}")
                return
            }

        // Prefer the exact questions the user saw, persisted on the submission (TAT_Impr_3).
        // Only fall back to a fresh repo fetch for legacy docs written before the `questions`
        // field existed -- getTATQuestions(testId) ignores testId and returns a random 12 that
        // won't match the user's questionIds, which is the root cause of the "0 bytes" bug.
        val questions = submission.questions.ifEmpty {
            testContentRepository.getTATQuestions(submission.testId).getOrNull().orEmpty()
        }
        val candidateGender = runCatching {
            userProfileRepository.getUserProfile(submission.userId).first().getOrNull()?.gender?.displayName
        }.getOrNull() ?: "Unknown"

        val assessments = mutableListOf<TATStoryAssessment>()
        submission.stories.forEachIndexed { index, storyResponse ->
            val question = questions.find { it.id == storyResponse.questionId }
            val assessment = analyzeStory(submissionId, storyResponse, question, candidateGender, index, submission.stories.size)
            if (assessment != null) assessments.add(assessment)
        }

        if (assessments.size < MIN_STORY_THRESHOLD) {
            logger.e(TAG, "Too few valid TAT story assessments (${assessments.size}/$MIN_STORY_THRESHOLD): $submissionId")
            submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED)
            return
        }

        val prompt = TATSynthesisPrompts.buildPrompt(assessments)
        val olqScores = AnalysisRetry.withRetry { aiService.analyzeTATResponse(prompt) }
        if (olqScores == null) {
            logger.e(TAG, "TAT synthesis AI call failed after retries: $submissionId")
            submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED)
            return
        }

        val userProfile = runCatching { userProfileRepository.getUserProfile(submission.userId).first().getOrNull() }
            .getOrNull()
        val entryType = ScoringUtils.toScoringEntryType(userProfile?.entryType)
        ValidationIntegration.validateScores(olqScores, entryType)

        val overallScore = olqScores.values.map { it.score }.average().toFloat()
        val failedCount = submission.stories.size - assessments.size
        val strengths = olqScores.entries.sortedBy { it.value.score }.take(3)
            .map { "${it.key.displayName} (${it.value.score})" }
        val weaknesses = olqScores.entries.sortedByDescending { it.value.score }.take(3)
            .map { "${it.key.displayName} (${it.value.score})" }

        val olqResult = OLQAnalysisResult(
            submissionId = submissionId,
            testType = TestType.TAT,
            olqScores = olqScores,
            overallScore = overallScore,
            overallRating = AnalysisRetry.ratingFromScore(overallScore),
            strengths = strengths,
            weaknesses = weaknesses,
            recommendations = listOf(
                "Review your narrative arcs across all stories",
                "Focus on strengthening: ${weaknesses.joinToString(", ")}",
                "Maintain proactive and optimistic storytelling"
            ),
            analyzedAt = Clock.System.now().toEpochMilliseconds(),
            aiConfidence = olqScores.values.map { it.confidence }.average().toInt(),
            validStoriesCount = assessments.size,
            failedStoriesCount = failedCount,
            usedPartialAssessment = failedCount > 0
        )

        val finalizeResult = submissionRepository.finalizeTATAnalysisResult(submissionId, olqResult)
        if (finalizeResult.isFailure) {
            logger.e(TAG, "Failed to finalize TAT result: $submissionId")
            submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED)
            return
        }
        runCatching { getOLQDashboard.invalidateCache(submission.userId) }
            .onFailure { logger.w(TAG, "Failed to invalidate dashboard cache: ${it.message}") }
    }

    private suspend fun analyzeStory(
        submissionId: String,
        storyResponse: com.ssbmax.shared.domain.model.TATStoryResponse,
        question: com.ssbmax.shared.domain.model.TATQuestion?,
        candidateGender: String,
        storyIndex: Int,
        totalStories: Int
    ): TATStoryAssessment? {
        val imageBytes = question?.imageUrl?.takeIf { it.isNotBlank() }?.let { downloadImageBytes(it) } ?: ByteArray(0)
        val imageContext = question?.imageContextJson
            ?.let { runCatching { Json.decodeFromString<TATImageContext>(it) }.getOrNull() }
            ?: TATImageContext()

        val olqScores = AnalysisRetry.withRetry {
            aiService.analyzeTATStoryMultimodal(
                imageBytes = imageBytes,
                story = storyResponse.story,
                imageContext = imageContext,
                candidateGender = candidateGender,
                storyIndex = storyIndex,
                totalStories = totalStories,
                imageGenderTag = question?.genderTag ?: "MIXED"
            )
        } ?: return null

        val overallScore = olqScores.values.map { it.score }.average().toFloat()
        return TATStoryAssessment(
            submissionId = submissionId,
            questionId = storyResponse.questionId,
            storyIndex = storyIndex,
            story = storyResponse.story,
            imageUrl = question?.imageUrl ?: "",
            olqScores = olqScores,
            overallScore = overallScore,
            overallRating = AnalysisRetry.ratingFromScore(overallScore),
            aiConfidence = olqScores.values.firstOrNull()?.confidence ?: 50
        )
    }

    private suspend fun downloadImageBytes(imageUrl: String): ByteArray = try {
        httpClient.get(imageUrl).body()
    } catch (e: Exception) {
        logger.w(TAG, "TAT story image download failed, proceeding with empty bytes: ${e.message}")
        ByteArray(0)
    }

    private companion object {
        const val TAG = "TATAnalysisOrchestrator"
        const val MIN_STORY_THRESHOLD = 6
        const val FEATURE_FLAG_SERVER_EVALUATION = "tat_server_evaluation"
    }
}
