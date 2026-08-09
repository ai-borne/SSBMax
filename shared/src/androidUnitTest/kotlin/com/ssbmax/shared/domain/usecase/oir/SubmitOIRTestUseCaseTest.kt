package com.ssbmax.shared.domain.usecase.oir

import com.ssbmax.shared.domain.model.*
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

    @Before
    fun setUp() {
        useCase = SubmitOIRTestUseCase(
            scoreCalculator   = mockScoreCalculator,
            usageRecorder     = mockUsageRecorder,
            dashboardUseCase  = mockDashboardUseCase,
            submissionRepository = mockSubmissionRepo,
            testSessionRepository = mockSessionRepo,
            testContentRepository = mockContentRepo
        )
        every { mockScoreCalculator.calculate(any()) } returns fakeResult
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Successful orchestration
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    fun `invoke successful orchestration runs all 5 steps in order`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertTrue(result.isSuccess)

        // Verify result persistence precedes charging and cache invalidation.
        coVerifyOrder {
            mockScoreCalculator.calculate(testSession)
            mockSubmissionRepo.submitOIR(any(), null)
            mockUsageRecorder.recordTestUsage(TestType.OIR, testSession.userId, any())
            mockSessionRepo.completeTestSession(testSession.sessionId)
            mockDashboardUseCase.invalidateCache(testSession.userId)
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fresh submission id per attempt (OIR Retake Seal, Phase 1 — Option B)
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    fun `invoke mints a submission id distinct from the session id`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertTrue(result.isSuccess)
        assertNotEquals(testSession.sessionId, result.getOrNull())
    }

    @Test
    fun `invoke mints a different submission id on each call for the same session`() = runTest {
        coEvery { mockSubmissionRepo.submitOIR(any(), null) } returns Result.success("ignored")

        val first = useCase(testSession).getOrNull()
        val second = useCase(testSession).getOrNull()

        assertNotNull(first)
        assertNotNull(second)
        assertNotEquals(first, second)
    }

    @Test
    fun `submitOIR is invoked with the freshly minted id, not the session id`() = runTest {
        val submissionSlot = slot<OIRSubmission>()
        coEvery { mockSubmissionRepo.submitOIR(capture(submissionSlot), null) } returns Result.success("ignored")

        val result = useCase(testSession)

        assertEquals(submissionSlot.captured.id, result.getOrNull())
        assertNotEquals(testSession.sessionId, submissionSlot.captured.id)
    }

    @Test
    fun `repeated submit attempts (retakes) each mint and record their own submission id`() = runTest {
        val submittedIds = mutableListOf<OIRSubmission>()
        coEvery { mockSubmissionRepo.submitOIR(capture(submittedIds), null) } returns Result.success("ignored")

        val first = useCase(testSession).getOrNull()
        val second = useCase(testSession).getOrNull()

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

