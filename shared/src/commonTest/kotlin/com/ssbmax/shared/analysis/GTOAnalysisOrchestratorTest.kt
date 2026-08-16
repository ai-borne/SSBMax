package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.service.OLQScoreWithReasoning
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.presentation.testing.FakeAIService
import com.ssbmax.shared.presentation.testing.FakeEvaluationFunctionsClient
import com.ssbmax.shared.presentation.testing.FakeFeatureFlagRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.RecordingLogger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Phase 8 (KMP-convergence plan): characterization tests pinning [GTOAnalysisOrchestrator] --
 * `app`'s `GTOAnalysisWorker` now delegates the whole AI-analysis flow to this class instead of
 * re-implementing it. Pins the one deliberately-Android-original-matching quirk: on AI failure
 * after retries, GTO writes neutral fallback scores rather than marking the submission FAILED
 * (GTO has no dedicated failure UI state, unlike WAT/SRT/SD/PPDT).
 *
 * Also covers Phase 8 Ship (Web SSB Test Flow Parity plan): the `gto_server_evaluation`
 * feature-flagged path that delegates to [com.ssbmax.shared.domain.service.EvaluationFunctionsClient]
 * instead, mirroring `WATAnalysisOrchestratorTest`'s equivalent case.
 */
class GTOAnalysisOrchestratorTest {

    private fun fullOlqAnalysis(): ResponseAnalysis = ResponseAnalysis(
        olqScores = OLQ.entries.associateWith { OLQScoreWithReasoning(it, 5f, "reasoning for ${it.name}") },
        overallConfidence = 80,
        keyInsights = listOf("insight")
    )

    private fun lecturetteSubmission(status: GTOSubmissionStatus) = GTOSubmission.LecturetteSubmission(
        id = "gto-1",
        userId = "user-1",
        testId = "test-1",
        topicChoices = listOf("Leadership"),
        selectedTopic = "Leadership",
        speechTranscript = "transcript",
        charCount = 10,
        timeSpent = 60,
        status = status
    )

    private fun getOLQDashboard(gtoRepository: FakeGTORepository) = GetOLQDashboardUseCase(
        FakeSubmissionRepository(), gtoRepository, FakeInterviewRepository(), RecordingLogger()
    )

    @Test
    fun `analyze writes OLQ scores and completes when AI succeeds`() = kotlinx.coroutines.test.runTest {
        val gtoRepo = FakeGTORepository().apply {
            submissionResult = Result.success(lecturetteSubmission(GTOSubmissionStatus.PENDING_ANALYSIS))
        }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = GTOAnalysisOrchestrator(
            gtoRepo, aiService, getOLQDashboard(gtoRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("gto-1")

        assertEquals(1, gtoRepo.recordedOLQScores.size)
        assertEquals(15, gtoRepo.recordedOLQScores.first().size)
        assertTrue(gtoRepo.recordedStatusUpdates.none { it == GTOSubmissionStatus.FAILED })
    }

    @Test
    fun `analyze writes neutral fallback scores rather than FAILED when AI never succeeds`() = kotlinx.coroutines.test.runTest {
        val gtoRepo = FakeGTORepository().apply {
            submissionResult = Result.success(lecturetteSubmission(GTOSubmissionStatus.PENDING_ANALYSIS))
        }
        val aiService = FakeAIService().apply {
            responseAnalysisResult = Result.failure(RuntimeException("Gemini unavailable"))
        }
        val orchestrator = GTOAnalysisOrchestrator(
            gtoRepo, aiService, getOLQDashboard(gtoRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("gto-1")

        assertEquals(1, gtoRepo.recordedOLQScores.size)
        assertEquals(15, gtoRepo.recordedOLQScores.first().size)
        assertTrue(gtoRepo.recordedOLQScores.first().values.all { it.score == 6 && it.confidence == 30 })
        assertTrue(gtoRepo.recordedStatusUpdates.none { it == GTOSubmissionStatus.FAILED })
    }

    @Test
    fun `analyze skips submissions that are not PENDING_ANALYSIS`() = kotlinx.coroutines.test.runTest {
        val gtoRepo = FakeGTORepository().apply {
            submissionResult = Result.success(lecturetteSubmission(GTOSubmissionStatus.COMPLETED))
        }
        val aiService = FakeAIService()
        val orchestrator = GTOAnalysisOrchestrator(
            gtoRepo, aiService, getOLQDashboard(gtoRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("gto-1")

        assertTrue(gtoRepo.recordedOLQScores.isEmpty())
    }

    @Test
    fun `analyze marks FAILED and does not throw when the Firestore write itself fails`() = kotlinx.coroutines.test.runTest {
        val gtoRepo = FakeGTORepository().apply {
            submissionResult = Result.success(lecturetteSubmission(GTOSubmissionStatus.PENDING_ANALYSIS))
            updateSubmissionOLQScoresResult = Result.failure(RuntimeException("Firestore write failed"))
        }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = GTOAnalysisOrchestrator(
            gtoRepo, aiService, getOLQDashboard(gtoRepo), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("gto-1")

        assertEquals(listOf(GTOSubmissionStatus.ANALYZING, GTOSubmissionStatus.FAILED), gtoRepo.recordedStatusUpdates)
    }

    @Test
    fun `analyze delegates to the server-side evaluation function and skips the legacy AI path when gto_server_evaluation is enabled`() =
        kotlinx.coroutines.test.runTest {
            val gtoRepo = FakeGTORepository().apply {
                submissionResult = Result.success(lecturetteSubmission(GTOSubmissionStatus.PENDING_ANALYSIS))
            }
            val aiService = FakeAIService()
            val evaluationFunctionsClient = FakeEvaluationFunctionsClient()
            val featureFlagRepository = FakeFeatureFlagRepository(
                flagsResult = FeatureFlags(flags = mapOf("gto_server_evaluation" to true))
            )
            val orchestrator = GTOAnalysisOrchestrator(
                gtoRepo, aiService, getOLQDashboard(gtoRepo), RecordingLogger(),
                featureFlagRepository, evaluationFunctionsClient
            )

            orchestrator.analyze("gto-1")

            assertEquals(listOf("gto-1"), evaluationFunctionsClient.evaluateGTOCalls)
            assertTrue(aiService.recordedPrompts.isEmpty(), "legacy client-side AI path must not run when the flag is on")
            assertTrue(gtoRepo.recordedOLQScores.isEmpty(), "the Cloud Function writes results itself, not this orchestrator")
        }
}
