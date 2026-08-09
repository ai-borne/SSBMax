package com.ssbmax.shared.analysis

import com.ssbmax.shared.ai.prompts.PsychologyTestPrompts
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.scoring.ScoringUtils
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.validation.ValidationIntegration
import kotlinx.coroutines.flow.first
import kotlin.time.Clock

/**
 * WAT/SRT/SD share the exact same orchestration shape in the Android originals
 * (`WATAnalysisWorker`/`SRTAnalysisWorker`/`SDTAnalysisWorker`) -- fetch -> verify
 * PENDING_ANALYSIS -> ANALYZING -> build prompt -> AI analyze (retry) -> SSB-validate
 * -> write OLQ result -> invalidate dashboard cache. Factored into one shared helper
 * plus three thin per-type wrappers rather than tripling ~120 lines each.
 */
private suspend fun runPsychAnalysis(
    testType: TestType,
    submissionId: String,
    userId: String,
    prompt: String,
    recommendations: List<String>,
    submissionRepository: SubmissionRepository,
    userProfileRepository: UserProfileRepository,
    aiService: AIService,
    getOLQDashboard: GetOLQDashboardUseCase,
    logger: DomainLogger,
    analyze: suspend (String) -> Result<com.ssbmax.shared.domain.service.ResponseAnalysis>,
    markAnalyzing: suspend () -> Result<Unit>,
    markFailed: suspend () -> Unit,
    writeResult: suspend (OLQAnalysisResult) -> Result<Unit>
) {
    markAnalyzing().onFailure {
        logger.e("PsychAnalysis", "Failed to mark $testType submission ANALYZING: $submissionId: ${it.message}")
        return
    }

    val olqScores = AnalysisRetry.withRetry { analyze(prompt) }
    if (olqScores == null) {
        logger.e("PsychAnalysis", "$testType AI analysis failed after retries: $submissionId")
        markFailed()
        return
    }

    val userProfile = runCatching { userProfileRepository.getUserProfile(userId).first().getOrNull() }.getOrNull()
    val entryType = ScoringUtils.toScoringEntryType(userProfile?.entryType)
    val validationResult = ValidationIntegration.validateScores(olqScores, entryType)
    logger.d("PsychAnalysis", "$testType SSB validation for $submissionId: ${validationResult.recommendation}")

    val overallScore = olqScores.values.map { it.score }.average().toFloat()
    val strengths = olqScores.entries.sortedBy { it.value.score }.take(3)
        .map { "${it.key.displayName} (${it.value.score})" }
    val weaknesses = olqScores.entries.sortedByDescending { it.value.score }.take(3)
        .map { "${it.key.displayName} (${it.value.score})" }

    writeResult(
        OLQAnalysisResult(
            submissionId = submissionId,
            testType = testType,
            olqScores = olqScores,
            overallScore = overallScore,
            overallRating = AnalysisRetry.ratingFromScore(overallScore),
            strengths = strengths,
            weaknesses = weaknesses,
            recommendations = recommendations,
            analyzedAt = Clock.System.now().toEpochMilliseconds(),
            aiConfidence = olqScores.values.firstOrNull()?.confidence ?: 50
        )
    ).onFailure {
        logger.e("PsychAnalysis", "Failed to persist $testType OLQ result: $submissionId: ${it.message}")
        markFailed()
        return
    }
    runCatching { getOLQDashboard.invalidateCache(userId) }
        .onFailure { logger.w("PsychAnalysis", "Failed to invalidate dashboard cache: ${it.message}") }
}

class WATAnalysisOrchestrator(
    private val submissionRepository: SubmissionRepository,
    private val userProfileRepository: UserProfileRepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val logger: DomainLogger
) {
    suspend fun analyze(submissionId: String) {
        val submission = submissionRepository.getWATSubmission(submissionId).getOrNull() ?: return
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return

        runPsychAnalysis(
            testType = TestType.WAT,
            submissionId = submissionId,
            userId = submission.userId,
            prompt = PsychologyTestPrompts.generateWATAnalysisPrompt(submission),
            recommendations = listOf(
                "Continue practicing WAT with diverse word associations",
                "Focus on improving identified weak areas",
                "Maintain quick and positive responses"
            ),
            submissionRepository = submissionRepository,
            userProfileRepository = userProfileRepository,
            aiService = aiService,
            getOLQDashboard = getOLQDashboard,
            logger = logger,
            analyze = { aiService.analyzeWATResponse(it) },
            markAnalyzing = { submissionRepository.updateWATAnalysisStatus(submissionId, AnalysisStatus.ANALYZING) },
            markFailed = { submissionRepository.updateWATAnalysisStatus(submissionId, AnalysisStatus.FAILED) },
            writeResult = { submissionRepository.updateWATOLQResult(submissionId, it) }
        )
    }
}

class SRTAnalysisOrchestrator(
    private val submissionRepository: SubmissionRepository,
    private val userProfileRepository: UserProfileRepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val logger: DomainLogger
) {
    suspend fun analyze(submissionId: String) {
        val submission = submissionRepository.getSRTSubmission(submissionId).getOrNull() ?: return
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return

        runPsychAnalysis(
            testType = TestType.SRT,
            submissionId = submissionId,
            userId = submission.userId,
            prompt = PsychologyTestPrompts.generateSRTAnalysisPrompt(submission),
            recommendations = listOf(
                "Continue practicing SRT with realistic scenarios",
                "Focus on strengthening identified weak areas",
                "Develop balanced and mature reactions to challenges"
            ),
            submissionRepository = submissionRepository,
            userProfileRepository = userProfileRepository,
            aiService = aiService,
            getOLQDashboard = getOLQDashboard,
            logger = logger,
            analyze = { aiService.analyzeSRTResponse(it) },
            markAnalyzing = { submissionRepository.updateSRTAnalysisStatus(submissionId, AnalysisStatus.ANALYZING) },
            markFailed = { submissionRepository.updateSRTAnalysisStatus(submissionId, AnalysisStatus.FAILED) },
            writeResult = { submissionRepository.updateSRTOLQResult(submissionId, it) }
        )
    }
}

class SDAnalysisOrchestrator(
    private val submissionRepository: SubmissionRepository,
    private val userProfileRepository: UserProfileRepository,
    private val aiService: AIService,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val logger: DomainLogger
) {
    suspend fun analyze(submissionId: String) {
        val submission = submissionRepository.getSDTSubmission(submissionId).getOrNull() ?: return
        if (submission.analysisStatus != AnalysisStatus.PENDING_ANALYSIS) return

        runPsychAnalysis(
            testType = TestType.SD,
            submissionId = submissionId,
            userId = submission.userId,
            prompt = PsychologyTestPrompts.generateSDAnalysisPrompt(submission),
            recommendations = listOf(
                "Continue developing self-awareness and goal orientation",
                "Focus on strengthening identified weak areas",
                "Reflect on your actions and their impact on others"
            ),
            submissionRepository = submissionRepository,
            userProfileRepository = userProfileRepository,
            aiService = aiService,
            getOLQDashboard = getOLQDashboard,
            logger = logger,
            analyze = { aiService.analyzeSDResponse(it) },
            markAnalyzing = { submissionRepository.updateSDTAnalysisStatus(submissionId, AnalysisStatus.ANALYZING) },
            markFailed = { submissionRepository.updateSDTAnalysisStatus(submissionId, AnalysisStatus.FAILED) },
            writeResult = { submissionRepository.updateSDTOLQResult(submissionId, it) }
        )
    }
}
