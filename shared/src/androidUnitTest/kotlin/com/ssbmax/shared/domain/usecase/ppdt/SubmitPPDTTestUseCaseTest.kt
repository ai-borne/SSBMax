package com.ssbmax.shared.domain.usecase.ppdt

import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.domain.model.PPDTTestSession
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * TDD tests for SubmitPPDTTestUseCase's durable-session completion contract.
 *
 * Regression coverage for the "stuck ACTIVE test_sessions doc" bug: before this fix, a
 * successful PPDT submission never called `completeTestSession`, so the session doc created by
 * LoadPPDTTestUseCase stayed ACTIVE forever -- blocking retakes of the same test for up to its
 * 2-hour expiresAt window (the exact production incident this test suite guards against).
 */
class SubmitPPDTTestUseCaseTest {

    private val mockSubmissionRepo = mockk<SubmissionRepository>()
    private val mockUserProfileRepo = mockk<UserProfileRepository>()
    private val mockGetSubscriptionTier = mockk<GetSubscriptionTierUseCase>()
    private val mockUsageRecorder = mockk<TestUsageRecorder>(relaxed = true)
    private val mockSessionRepo = mockk<TestSessionRepository>(relaxed = true)

    private lateinit var useCase: SubmitPPDTTestUseCase

    private val testSession = PPDTTestSession(
        sessionId = "user-001_ppdt_standard",
        userId = "user-001",
        questionId = "ppdt_image_001",
        question = mockk<PPDTQuestion>(relaxed = true),
        startTime = 0L,
        imageViewingStartTime = 0L,
        writingStartTime = 0L,
        currentPhase = PPDTPhase.WRITING,
        story = "A test story with enough characters to pass validation checks in the flow.",
        isCompleted = false,
        isPaused = false
    )

    @Before
    fun setUp() {
        useCase = SubmitPPDTTestUseCase(
            submissionRepository = mockSubmissionRepo,
            userProfileRepository = mockUserProfileRepo,
            getSubscriptionTier = mockGetSubscriptionTier,
            usageRecorder = mockUsageRecorder,
            testSessionRepository = mockSessionRepo
        )
        coEvery { mockUserProfileRepo.getUserProfile(any()) } returns flowOf(
            Result.success(mockk<UserProfile>(relaxed = true))
        )
        coEvery { mockGetSubscriptionTier(any()) } returns Result.success(SubscriptionTier.FREE)
    }

    @Test
    fun `invoke completes the durable test session after a successful submission`() = runTest {
        coEvery { mockSubmissionRepo.submitPPDT(any(), null) } returns Result.success("submission-1")

        val result = useCase(testSession)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { mockSessionRepo.completeTestSession(testSession.sessionId) }
    }

    @Test
    fun `invoke completes the session only after submission and usage recording succeed`() = runTest {
        coEvery { mockSubmissionRepo.submitPPDT(any(), null) } returns Result.success("submission-1")

        useCase(testSession)

        coVerifyOrder {
            mockSubmissionRepo.submitPPDT(any(), null)
            mockUsageRecorder.recordTestUsage(any(), testSession.userId, any())
            mockSessionRepo.completeTestSession(testSession.sessionId)
        }
    }

    @Test
    fun `invoke does NOT complete the session when submission persistence fails`() = runTest {
        coEvery { mockSubmissionRepo.submitPPDT(any(), any()) } returns
            Result.failure(Exception("Firestore error"))

        val result = useCase(testSession)

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { mockSessionRepo.completeTestSession(any()) }
    }
}
