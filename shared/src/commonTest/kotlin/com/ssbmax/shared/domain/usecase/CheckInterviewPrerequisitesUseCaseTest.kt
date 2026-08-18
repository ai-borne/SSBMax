package com.ssbmax.shared.domain.usecase

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.OIRStatus
import com.ssbmax.shared.domain.model.interview.PIQStatus
import com.ssbmax.shared.domain.model.interview.PPDTStatus
import com.ssbmax.shared.domain.model.interview.PrerequisiteCheckResult
import com.ssbmax.shared.domain.model.interview.SubscriptionStatus
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * New in Phase 10 of the dev-subscription-override plan. Covers the reshaped
 * [PrerequisiteCheckResult.limitReached]: a genuine interview limit (real tier, over its real
 * `SubscriptionLimits` cap) now populates it instead of appending one more sentence to
 * `failureReasons`, so [com.ssbmax.shared.presentation.interviewstart.StartInterviewScreen] can
 * render it through the same shared `TestLimitReachedDialog` as every other test type. The two
 * fallback paths (tier lookup itself failed) are deliberately left emitting the old plain string --
 * there's no real tier to build a [TestEligibility.LimitReached] from at those sites.
 */
class CheckInterviewPrerequisitesUseCaseTest {

    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var interviewRepository: FakeInterviewRepository
    private lateinit var submissionRepository: FakeSubmissionRepository

    @BeforeTest
    fun setUp() {
        subscriptionRepository = FakeSubscriptionRepository()
        interviewRepository = FakeInterviewRepository()
        submissionRepository = FakeSubmissionRepository()
    }

    private fun buildUseCase() = CheckInterviewPrerequisitesUseCase(
        submissionRepository = submissionRepository,
        subscriptionRepository = subscriptionRepository,
        interviewRepository = interviewRepository
    )

    @Test
    fun `genuine limit populates limitReached without duplicating a failure-reason sentence`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        interviewRepository.interviewStatsResult = Result.success(mapOf(InterviewMode.VOICE_BASED to 3))
        val useCase = buildUseCase()

        val result = useCase(userId = "user-1").getOrThrow()

        val limitReached = assertNotNull(result.limitReached)
        assertEquals(SubscriptionTier.PRO, limitReached.tier)
        assertEquals(3, limitReached.limit)
        assertEquals(3, limitReached.usedCount)
        assertTrue(result.failureReasons.none { it.contains("Interview limit reached") })
        assertFalse(result.isEligible)
    }

    @Test
    fun `tier lookup failure falls back to a plain failure reason with limitReached null`() = runTest {
        subscriptionRepository.tierResult = Result.failure(Exception("network down"))
        val useCase = buildUseCase()

        val result = useCase(userId = "user-1").getOrThrow()

        assertNull(result.limitReached)
        assertTrue(result.failureReasons.any { it.contains("Interview limit reached for Unknown tier") })
        assertFalse(result.isEligible)
    }

    @Test
    fun `non-limit failures are unaffected when the subscription has headroom`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        // Default FakeInterviewRepository.interviewStatsResult is empty -> used = 0, under PRO's limit of 3.
        val useCase = buildUseCase()

        val result = useCase(userId = "user-1").getOrThrow()

        assertNull(result.limitReached)
        assertTrue(result.failureReasons.isNotEmpty()) // PIQ/OIR/PPDT all NotStarted by default
        assertFalse(result.isEligible)
    }

    /**
     * Direct regression guard for the crash this phase fixes: before Phase 10, a user ineligible
     * *only* because of a genuine limit had an empty `failureReasons` (the limit sentence moved to
     * `limitReached`), which `PrerequisiteCheckResult.init`'s old
     * `require(failureReasons.isNotEmpty())` would have rejected outright.
     */
    @Test
    fun `limit-only ineligible result constructs without throwing`() {
        PrerequisiteCheckResult(
            isEligible = false,
            piqStatus = PIQStatus.Completed(submissionId = "piq-1", aiScore = 80f),
            oirStatus = OIRStatus.Completed(submissionId = "oir-1", score = 80f),
            ppdtStatus = PPDTStatus.Completed(submissionId = "ppdt-1"),
            subscriptionStatus = SubscriptionStatus.LimitReached(
                tier = "Pro",
                used = 1,
                limit = 1,
                subscriptionTier = SubscriptionTier.PRO
            ),
            failureReasons = emptyList(),
            limitReached = TestEligibility.LimitReached(
                tier = SubscriptionTier.PRO,
                limit = 1,
                usedCount = 1,
                resetsAt = "Sep 1, 2026"
            )
        )
    }
}
