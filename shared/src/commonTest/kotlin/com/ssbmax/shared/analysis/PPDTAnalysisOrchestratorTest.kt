package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.service.OLQScoreWithReasoning
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.presentation.testing.FakeAIService
import com.ssbmax.shared.presentation.testing.FakeEvaluationFunctionsClient
import com.ssbmax.shared.presentation.testing.FakeFeatureFlagRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
import com.ssbmax.shared.presentation.testing.RecordingLogger
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpStatusCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Phase 8 (KMP-convergence plan): characterization test pinning [PPDTAnalysisOrchestrator] --
 * `app`'s `PPDTAnalysisWorker` now delegates the whole AI-analysis flow to this class instead
 * of re-implementing it. Uses a blank `imageUrl` so the [HttpClient] download path is never
 * exercised (its own `MockEngine` only exists to satisfy the constructor -- a real download-path
 * test belongs to [PPDTAnalysisOrchestrator]'s own doc, not this characterization pass).
 */
class PPDTAnalysisOrchestratorTest {

    private fun fullOlqAnalysis(): ResponseAnalysis = ResponseAnalysis(
        olqScores = OLQ.entries.associateWith { OLQScoreWithReasoning(it, 5f, "reasoning for ${it.name}") },
        overallConfidence = 80,
        keyInsights = listOf("insight")
    )

    private fun submission(status: AnalysisStatus) = PPDTSubmission(
        submissionId = "ppdt-1",
        questionId = "q-1",
        userId = "user-1",
        userName = "name",
        userEmail = "email",
        batchId = null,
        story = "story",
        charactersCount = 200,
        viewingTimeTakenSeconds = 30,
        writingTimeTakenMinutes = 4,
        submittedAt = 0L,
        status = SubmissionStatus.SUBMITTED_PENDING_REVIEW,
        instructorReview = null,
        analysisStatus = status
    )

    private fun noopHttpClient() = HttpClient(MockEngine) {
        engine { addHandler { respondError(HttpStatusCode.NotFound) } }
    }

    @Test
    fun `analyze writes OLQ result when AI succeeds`() = kotlinx.coroutines.test.runTest {
        var writtenScores: Map<OLQ, com.ssbmax.shared.domain.model.interview.OLQScore>? = null
        val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository().apply {
            ppdtSubmissionResult = Result.success(submission(AnalysisStatus.PENDING_ANALYSIS))
        }) {
            override suspend fun updatePPDTOLQResult(submissionId: String, olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> {
                writtenScores = olqResult.olqScores
                return Result.success(Unit)
            }
        }
        val testContentRepo = FakeTestContentRepository().apply {
            ppdtQuestionResult = Result.success(PPDTQuestion(id = "q-1", imageUrl = "", imageDescription = "desc"))
        }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = PPDTAnalysisOrchestrator(
            submissionRepo, testContentRepo, FakeUserProfileRepository(), aiService,
            GetOLQDashboardUseCase(submissionRepo, FakeGTORepository(), FakeInterviewRepository(), RecordingLogger()),
            noopHttpClient(), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("ppdt-1")

        assertEquals(15, writtenScores?.size)
    }

    @Test
    fun `analyze marks FAILED when AI never succeeds`() = kotlinx.coroutines.test.runTest {
        var recordedStatus: AnalysisStatus? = null
        val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository().apply {
            ppdtSubmissionResult = Result.success(submission(AnalysisStatus.PENDING_ANALYSIS))
        }) {
            override suspend fun updatePPDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> {
                recordedStatus = status
                return Result.success(Unit)
            }
        }
        val testContentRepo = FakeTestContentRepository().apply {
            ppdtQuestionResult = Result.success(PPDTQuestion(id = "q-1", imageUrl = "", imageDescription = "desc"))
        }
        val aiService = FakeAIService().apply { responseAnalysisResult = Result.failure(RuntimeException("Gemini unavailable")) }
        val orchestrator = PPDTAnalysisOrchestrator(
            submissionRepo, testContentRepo, FakeUserProfileRepository(), aiService,
            GetOLQDashboardUseCase(submissionRepo, FakeGTORepository(), FakeInterviewRepository(), RecordingLogger()),
            noopHttpClient(), RecordingLogger(),
            FakeFeatureFlagRepository(), FakeEvaluationFunctionsClient()
        )

        orchestrator.analyze("ppdt-1")

        assertEquals(AnalysisStatus.FAILED, recordedStatus)
    }

    @Test
    fun `analyze delegates to the server-side evaluation function and skips the legacy AI path when ppdt_server_evaluation is enabled`() =
        kotlinx.coroutines.test.runTest {
            var legacyStatusUpdateCalled = false
            val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository().apply {
                ppdtSubmissionResult = Result.success(submission(AnalysisStatus.PENDING_ANALYSIS))
            }) {
                override suspend fun updatePPDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> {
                    legacyStatusUpdateCalled = true
                    return Result.success(Unit)
                }
            }
            val testContentRepo = FakeTestContentRepository().apply {
                ppdtQuestionResult = Result.success(PPDTQuestion(id = "q-1", imageUrl = "", imageDescription = "desc"))
            }
            val aiService = FakeAIService()
            val evaluationFunctionsClient = FakeEvaluationFunctionsClient()
            val featureFlagRepository = FakeFeatureFlagRepository(
                flagsResult = FeatureFlags(flags = mapOf("ppdt_server_evaluation" to true))
            )
            val orchestrator = PPDTAnalysisOrchestrator(
                submissionRepo, testContentRepo, FakeUserProfileRepository(), aiService,
                GetOLQDashboardUseCase(submissionRepo, FakeGTORepository(), FakeInterviewRepository(), RecordingLogger()),
                noopHttpClient(), RecordingLogger(),
                featureFlagRepository, evaluationFunctionsClient
            )

            orchestrator.analyze("ppdt-1")

            assertEquals(listOf("ppdt-1"), evaluationFunctionsClient.evaluatePPDTCalls)
            assertTrue(!legacyStatusUpdateCalled, "legacy client-side AI path (status ANALYZING/FAILED flip) must not run when the flag is on")
        }
}
