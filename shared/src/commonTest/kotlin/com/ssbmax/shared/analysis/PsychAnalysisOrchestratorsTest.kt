package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.WATSubmission
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.service.OLQScoreWithReasoning
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.presentation.testing.FakeAIService
import com.ssbmax.shared.presentation.testing.FakeEvaluationFunctionsClient
import com.ssbmax.shared.presentation.testing.FakeFeatureFlagRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
import com.ssbmax.shared.presentation.testing.RecordingLogger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Phase 8 (KMP-convergence plan): characterization tests pinning the SSOT behavior of
 * [WATAnalysisOrchestrator]/[SRTAnalysisOrchestrator]/[SDAnalysisOrchestrator] -- the exact
 * flow `app`'s `WATAnalysisWorker`/`SRTAnalysisWorker`/`SDTAnalysisWorker` now delegate to
 * instead of re-implementing. A full 15-OLQ [ResponseAnalysis] pins that scores round-trip
 * without loss; a 14-OLQ one pins the fill-missing-with-neutral-6 behavior both the orchestrator
 * and the Android originals share.
 */
class PsychAnalysisOrchestratorsTest {

    private fun fullOlqAnalysis(score: Float = 5f, confidence: Int = 80): ResponseAnalysis =
        ResponseAnalysis(
            olqScores = OLQ.entries.associateWith { OLQScoreWithReasoning(it, score, "reasoning for ${it.name}") },
            overallConfidence = confidence,
            keyInsights = listOf("insight")
        )

    private fun partialOlqAnalysis(missing: OLQ): ResponseAnalysis =
        ResponseAnalysis(
            olqScores = OLQ.entries.filter { it != missing }
                .associateWith { OLQScoreWithReasoning(it, 5f, "reasoning") },
            overallConfidence = 80,
            keyInsights = listOf("insight")
        )

    private fun getOLQDashboard(
        submissionRepository: SubmissionRepository,
        gtoRepository: GTORepository = FakeGTORepository(),
        interviewRepository: InterviewRepository = FakeInterviewRepository()
    ) = GetOLQDashboardUseCase(submissionRepository, gtoRepository, interviewRepository, RecordingLogger())

    private fun watSubmission(status: AnalysisStatus) = WATSubmission(
        id = "wat-1",
        userId = "user-1",
        testId = "test-1",
        responses = emptyList(),
        totalTimeTakenMinutes = 15,
        submittedAt = 0L,
        analysisStatus = status
    )

    // --- WAT ---

    @Test
    fun `WAT analyze writes OLQ result and completes when AI returns all 15 scores`() = kotlinx.coroutines.test.runTest {
        var writtenScores: Map<OLQ, OLQScore>? = null
        val submissionRepo = object : SubmissionRepository by (FakeSubmissionRepository().apply {
            watSubmissionResult = Result.success(watSubmission(AnalysisStatus.PENDING_ANALYSIS))
        }) {
            override suspend fun updateWATOLQResult(submissionId: String, olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> {
                writtenScores = olqResult.olqScores
                return Result.success(Unit)
            }
        }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = WATAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("wat-1")

        assertEquals(15, writtenScores?.size)
        assertEquals(1, aiService.recordedPrompts.size)
    }

    @Test
    fun `WAT analyze fills the missing OLQ with a neutral score when AI returns 14 of 15`() = kotlinx.coroutines.test.runTest {
        var writtenScores: Map<OLQ, OLQScore>? = null
        val submissionRepo = object : SubmissionRepository by (FakeSubmissionRepository().apply {
            watSubmissionResult = Result.success(watSubmission(AnalysisStatus.PENDING_ANALYSIS))
        }) {
            override suspend fun updateWATOLQResult(submissionId: String, olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> {
                writtenScores = olqResult.olqScores
                return Result.success(Unit)
            }
        }
        val aiService = FakeAIService().apply {
            responseAnalysisResult = Result.success(partialOlqAnalysis(missing = OLQ.STAMINA))
        }
        val orchestrator = WATAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("wat-1")

        assertEquals(15, writtenScores?.size)
        assertEquals(6, writtenScores?.get(OLQ.STAMINA)?.score)
    }

    @Test
    fun `WAT analyze skips submissions that are not PENDING_ANALYSIS`() = kotlinx.coroutines.test.runTest {
        val submissionRepo = FakeSubmissionRepository().apply {
            watSubmissionResult = Result.success(watSubmission(AnalysisStatus.COMPLETED))
        }
        val aiService = FakeAIService()
        val orchestrator = WATAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("wat-1")

        assertTrue(aiService.recordedPrompts.isEmpty())
    }

    @Test
    fun `WAT analyze marks FAILED when AI analysis never returns enough OLQs`() = kotlinx.coroutines.test.runTest {
        var recordedStatus: AnalysisStatus? = null
        val submissionRepo = object : SubmissionRepository by (FakeSubmissionRepository().apply {
            watSubmissionResult = Result.success(watSubmission(AnalysisStatus.PENDING_ANALYSIS))
        }) {
            override suspend fun updateWATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> {
                recordedStatus = status
                return Result.success(Unit)
            }
        }
        val aiService = FakeAIService().apply {
            // Only 5 of 15 OLQs -- below AnalysisRetry's MIN_ACCEPTABLE_OLQS=14 acceptance floor.
            responseAnalysisResult = Result.success(
                fullOlqAnalysis().let { it.copy(olqScores = it.olqScores.entries.take(5).associate { e -> e.key to e.value }) }
            )
        }
        val orchestrator = WATAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("wat-1")

        assertEquals(AnalysisStatus.FAILED, recordedStatus)
    }

    @Test
    fun `WAT analyze delegates to the server-side evaluation function and skips the legacy AI path when wat_server_evaluation is enabled`() =
        kotlinx.coroutines.test.runTest {
            val submissionRepo = FakeSubmissionRepository().apply {
                watSubmissionResult = Result.success(watSubmission(AnalysisStatus.PENDING_ANALYSIS))
            }
            val aiService = FakeAIService()
            val evaluationFunctionsClient = FakeEvaluationFunctionsClient()
            val featureFlagRepository = FakeFeatureFlagRepository(
                flagsResult = FeatureFlags(flags = mapOf("wat_server_evaluation" to true))
            )
            val orchestrator = WATAnalysisOrchestrator(
                submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
                featureFlagRepository, evaluationFunctionsClient
            )

            orchestrator.analyze("wat-1")

            assertEquals(listOf("wat-1"), evaluationFunctionsClient.evaluateWATCalls)
            assertTrue(aiService.recordedPrompts.isEmpty(), "legacy client-side AI path must not run when the flag is on")
        }

    // --- SRT ---

    @Test
    fun `SRT analyze writes OLQ result on success`() = kotlinx.coroutines.test.runTest {
        val submission = SRTSubmission(
            id = "srt-1", userId = "user-1", testId = "test-1", responses = emptyList(),
            totalTimeTakenMinutes = 30, submittedAt = 0L, analysisStatus = AnalysisStatus.PENDING_ANALYSIS
        )
        val submissionRepo = FakeSubmissionRepository().apply { srtSubmissionResult = Result.success(submission) }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = SRTAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("srt-1")

        assertEquals(1, aiService.recordedPrompts.size)
    }

    @Test
    fun `SRT analyze delegates to the server-side evaluation function and skips the legacy AI path when srt_server_evaluation is enabled`() =
        kotlinx.coroutines.test.runTest {
            val submission = SRTSubmission(
                id = "srt-1", userId = "user-1", testId = "test-1", responses = emptyList(),
                totalTimeTakenMinutes = 30, submittedAt = 0L, analysisStatus = AnalysisStatus.PENDING_ANALYSIS
            )
            val submissionRepo = FakeSubmissionRepository().apply { srtSubmissionResult = Result.success(submission) }
            val aiService = FakeAIService()
            val evaluationFunctionsClient = FakeEvaluationFunctionsClient()
            val featureFlagRepository = FakeFeatureFlagRepository(
                flagsResult = FeatureFlags(flags = mapOf("srt_server_evaluation" to true))
            )
            val orchestrator = SRTAnalysisOrchestrator(
                submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
                featureFlagRepository, evaluationFunctionsClient
            )

            orchestrator.analyze("srt-1")

            assertEquals(listOf("srt-1"), evaluationFunctionsClient.evaluateSRTCalls)
            assertTrue(aiService.recordedPrompts.isEmpty(), "legacy client-side AI path must not run when the flag is on")
        }

    @Test
    fun `SRT analyze skips submissions that are not PENDING_ANALYSIS`() = kotlinx.coroutines.test.runTest {
        val submission = SRTSubmission(
            id = "srt-1", userId = "user-1", testId = "test-1", responses = emptyList(),
            totalTimeTakenMinutes = 30, submittedAt = 0L, analysisStatus = AnalysisStatus.COMPLETED
        )
        val submissionRepo = FakeSubmissionRepository().apply { srtSubmissionResult = Result.success(submission) }
        val aiService = FakeAIService()
        val orchestrator = SRTAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("srt-1")

        assertTrue(aiService.recordedPrompts.isEmpty())
    }

    // --- SD ---

    @Test
    fun `SD analyze writes OLQ result on success`() = kotlinx.coroutines.test.runTest {
        val submission = SDTSubmission(
            id = "sd-1", userId = "user-1", testId = "test-1", responses = emptyList(),
            totalTimeTakenMinutes = 15, submittedAt = 0L, analysisStatus = AnalysisStatus.PENDING_ANALYSIS
        )
        val submissionRepo = FakeSubmissionRepository().apply { sdtSubmissionResult = Result.success(submission) }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = SDAnalysisOrchestrator(
            submissionRepo, FakeUserProfileRepository(), aiService, getOLQDashboard(submissionRepo), RecordingLogger()
        )

        orchestrator.analyze("sd-1")

        assertEquals(1, aiService.recordedPrompts.size)
    }
}
