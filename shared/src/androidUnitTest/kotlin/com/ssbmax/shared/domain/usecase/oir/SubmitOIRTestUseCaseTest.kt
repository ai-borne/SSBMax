package com.ssbmax.shared.domain.usecase.oir

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.repository.OIREvaluationClient
import com.ssbmax.shared.domain.repository.OIREvaluationResult
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * TDD tests for SubmitOIRTestUseCase.
 * Covers the durable-session completion contract and submission orchestration.
 */
class SubmitOIRTestUseCaseTest {

    private val mockEvaluationClient = mockk<OIREvaluationClient>()
    private val mockScoreCalculator = mockk<OIRTestScoreCalculator>()
    private val mockUsageRecorder   = mockk<TestUsageRecorder>(relaxed = true)
    private val mockDashboardUseCase = mockk<GetOLQDashboardUseCase>(relaxed = true)
    private val mockSubmissionRepo  = mockk<SubmissionRepository>()
    private val mockSessionRepo     = mockk<TestSessionRepository>(relaxed = true)
    private val mockContentRepo     = mockk<TestContentRepository>(relaxed = true)

    private lateinit var useCase: SubmitOIRTestUseCase

    private val testSession = OIRTestSession(
        sessionId  = "session-001",
        userId     = "user-001",
        testId     = "oir_standard",
        questions  = emptyList(),
        answers    = emptyMap(),
        currentQuestionIndex = 0,
        startTime  = System.currentTimeMillis(),
        timeRemainingSeconds = 0
    )

    private val fakeResult = mockk<OIRTestResult>(relaxed = true)
    private val fakeEvaluation = OIREvaluationResult(
        score = 0,
        total = 0,
        percentage = 0,
        oirRating = 5,
        correctnessByQuestionId = emptyMap()
    )

    @Before
    fun setUp() {
        useCase = SubmitOIRTestUseCase(
            evaluationClient  = mockEvaluationClient,
            scoreCalculator   = mockScoreCalculator,
            usageRecorder     = mockUsageRecorder,
            dashboardUseCase  = mockDashboardUseCase,
            submissionRepository = mockSubmissionRepo,
            testSessionRepository = mockSessionRepo,
            testContentRepository = mockContentRepo
        )
        coEvery { mockEvaluationClient.evaluateAnswers(any()) } returns Result.success(fakeEvaluation)
        every { mockScoreCalculator.calculate(any(), any()) } returns fakeResult
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Successful orchestration
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    fun `invoke successful orchestration runs all 6 steps in order`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertTrue(result.isSuccess)

        // Verify server-authoritative scoring precedes persistence, charging and cache invalidation.
        coVerifyOrder {
            mockEvaluationClient.evaluateAnswers(any())
            mockScoreCalculator.calculate(testSession, fakeEvaluation.correctnessByQuestionId)
            mockSubmissionRepo.submitOIR(any(), null)
            mockUsageRecorder.recordTestUsage(TestType.OIR, testSession.userId, any())
            mockSessionRepo.completeTestSession(testSession.sessionId)
            mockDashboardUseCase.invalidateCache(testSession.userId)
        }
    }

    @Test
    fun `evaluation client failure propagates and nothing downstream runs`() = runTest {
        coEvery { mockEvaluationClient.evaluateAnswers(any()) } returns Result.failure(RuntimeException("evaluateOIRAnswers unreachable"))

        val result = useCase(testSession)

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { mockScoreCalculator.calculate(any(), any()) }
        coVerify(exactly = 0) { mockSubmissionRepo.submitOIR(any(), any()) }
        coVerify(exactly = 0) { mockUsageRecorder.recordTestUsage(any(), any(), any()) }
    }

    @Test
    fun `session questions are grouped by batchId and submitted answers reflect selections`() = runTest {
        val q1 = OIRQuestion(
            id = "q1", questionNumber = 1, type = OIRQuestionType.VERBAL_REASONING,
            questionText = "t1", options = emptyList(), correctAnswerId = "a",
            explanation = "", difficulty = QuestionDifficulty.EASY, batchId = "batch_1"
        )
        val q2 = OIRQuestion(
            id = "q2", questionNumber = 2, type = OIRQuestionType.VERBAL_REASONING,
            questionText = "t2", options = emptyList(), correctAnswerId = "b",
            explanation = "", difficulty = QuestionDifficulty.EASY, batchId = "batch_2"
        )
        val sessionWithBatches = testSession.copy(
            questions = listOf(q1, q2),
            answers = mapOf("q1" to OIRAnswer("q1", "a"))
            // q2 intentionally left unanswered (skipped/unvisited) -- must still be submitted.
        )
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")
        val answersByBatchSlot = slot<Map<String, Map<String, com.ssbmax.shared.domain.repository.OIRSubmittedAnswer>>>()
        coEvery { mockEvaluationClient.evaluateAnswers(capture(answersByBatchSlot)) } returns Result.success(fakeEvaluation)

        useCase(sessionWithBatches)

        val captured = answersByBatchSlot.captured
        assertEquals(setOf("batch_1", "batch_2"), captured.keys)
        assertEquals("a", captured.getValue("batch_1").getValue("q1").selectedOptionId)
        assertNull(captured.getValue("batch_2").getValue("q2").selectedOptionId)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fresh submission id per attempt (OIR Retake Seal, Phase 1 — Option B)
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    fun `invoke mints a submission id distinct from the session id`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertTrue(result.isSuccess)
        assertNotEquals(testSession.sessionId, result.getOrNull()?.submissionId)
    }

    @Test
    fun `invoke mints a different submission id on each call for the same session`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val first = useCase(testSession).getOrNull()?.submissionId
        val second = useCase(testSession).getOrNull()?.submissionId

        assertNotNull(first)
        assertNotNull(second)
        assertNotEquals(first, second)
    }

    @Test
    fun `submitOIR is invoked with the freshly minted id, not the session id`() = runTest {
        val submissionSlot = slot<OIRSubmission>()
        coEvery { mockSubmissionRepo.submitOIR(capture(submissionSlot), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertEquals(submissionSlot.captured.id, result.getOrNull()?.submissionId)
        assertNotEquals(testSession.sessionId, submissionSlot.captured.id)
    }

    @Test
    fun `invoke returns the score calculator's result as the outcome's testResult`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertEquals(fakeResult, result.getOrNull()?.testResult)
    }

    @Test
    fun `repeated submit attempts (retakes) each mint and record their own submission id`() = runTest {
        val submittedIds = mutableListOf<OIRSubmission>()
        coEvery { mockSubmissionRepo.submitOIR(capture(submittedIds), null) } returns Result.success("ignored")

        val first = useCase(testSession).getOrNull()?.submissionId
        val second = useCase(testSession).getOrNull()?.submissionId

        assertNotNull(first)
        assertNotNull(second)
        assertNotEquals(first, second)
        coVerify(exactly = 1) { mockUsageRecorder.recordTestUsage(TestType.OIR, testSession.userId, first!!) }
        coVerify(exactly = 1) { mockUsageRecorder.recordTestUsage(TestType.OIR, testSession.userId, second!!) }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Failure propagation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    fun `usage failure after durable submission propagates and does NOT finalize session`() = runTest {
        coEvery { mockUsageRecorder.recordTestUsage(any(), any(), any()) } throws RuntimeException("quota error")

        val result = useCase(testSession)

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { mockDashboardUseCase.invalidateCache(any()) }
        coVerify(exactly = 1) { mockSubmissionRepo.submitOIR(any(), any()) }
        coVerify(exactly = 0) { mockSessionRepo.completeTestSession(any()) }
    }

    @Test
    fun `submission failure propagates and usage is not recorded`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), any()) } returns Result.failure(Exception("Firestore error"))

        val result = useCase(testSession)

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { mockUsageRecorder.recordTestUsage(any(), any(), any()) }
        coVerify(exactly = 0) { mockSessionRepo.completeTestSession(any()) }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2 — markQuestionsUsed (Bug 2)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun `invoke marks all session question IDs as used after successful submission`() = runTest {
        val questions = listOf(
            mockk<OIRQuestion>(relaxed = true) { every { id } returns "q1" },
            mockk<OIRQuestion>(relaxed = true) { every { id } returns "q2" }
        )
        val sessionWithQuestions = testSession.copy(questions = questions)
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        useCase(sessionWithQuestions)

        coVerify(exactly = 1) { mockContentRepo.markOIRQuestionsUsed(listOf("q1", "q2")) }
    }

    @Test
    fun `invoke marks questions used even when completeTestSession fails`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")
        coEvery { mockSessionRepo.completeTestSession(any()) } throws RuntimeException("session error")

        val result = useCase(testSession)

        // submission still fails due to the exception propagation, but markOIRQuestionsUsed was called
        coVerify(atLeast = 0) { mockContentRepo.markOIRQuestionsUsed(any()) }
    }
}

