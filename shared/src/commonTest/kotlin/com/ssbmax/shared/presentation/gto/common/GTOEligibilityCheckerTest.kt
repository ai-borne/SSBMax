@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.gto.common

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.RecordingAnalyticsTracker
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * New in Phase 9 of the dev-subscription-override plan -- [GTOEligibilityChecker]
 * previously had no tests of its own. Written for the reshaped `Result.LimitReached`,
 * which now carries the real [com.ssbmax.shared.domain.model.TestEligibility.LimitReached]
 * instead of a pre-formatted string, so the 3 GTO ViewModels/screens can render it through
 * the shared `TestLimitReachedDialog` (matching every other test type) instead of a
 * GTO-only dialog with its own hand-built message.
 */
class GTOEligibilityCheckerTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var gtoRepository: FakeGTORepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        gtoRepository = FakeGTORepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildChecker(): GTOEligibilityChecker = GTOEligibilityChecker(
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
        gtoRepository = gtoRepository,
        checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
        logger = NoOpLogger(),
        analyticsTracker = RecordingAnalyticsTracker()
    )

    @Test
    fun `checkEligibility carries the real eligibility when the limit is reached`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("GTO" to UsageInfo(used = 1, limit = 1))
        )
        val checker = buildChecker()

        val result = checker.checkEligibility(TestType.GTO_GD, GTOTestType.GROUP_DISCUSSION)

        val limitReached = assertIs<GTOEligibilityChecker.Result.LimitReached>(result)
        assertEquals(SubscriptionTier.FREE, limitReached.eligibility.tier)
        assertEquals(1, limitReached.eligibility.limit)
        assertEquals(1, limitReached.eligibility.usedCount)
    }

    @Test
    fun `checkEligibility resolves eligible when under the limit`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        val checker = buildChecker()

        val result = checker.checkEligibility(TestType.GTO_GD, GTOTestType.GROUP_DISCUSSION)

        val eligible = assertIs<GTOEligibilityChecker.Result.Eligible>(result)
        assertEquals(testUser().id, eligible.userId)
        assertEquals(SubscriptionTier.PRO, eligible.subscriptionType)
    }

    @Test
    fun `checkEligibility surfaces an error when sequential access is denied`() = runTest(testDispatcher) {
        gtoRepository.canUserTakeTestResult = Result.success(false)
        val checker = buildChecker()

        val result = checker.checkEligibility(TestType.GTO_LECTURETTE, GTOTestType.LECTURETTE)

        assertIs<GTOEligibilityChecker.Result.Error>(result)
    }

    @Test
    fun `checkEligibility surfaces an error when unauthenticated`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val checker = buildChecker()

        val result = checker.checkEligibility(TestType.GTO_GD, GTOTestType.GROUP_DISCUSSION)

        assertIs<GTOEligibilityChecker.Result.Error>(result)
    }
}
