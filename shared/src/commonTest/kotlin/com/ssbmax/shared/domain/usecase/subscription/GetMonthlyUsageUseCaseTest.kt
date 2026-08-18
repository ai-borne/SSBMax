package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): this use case backs
 * `SubscriptionManagementScreen`'s usage display and must key by the same period as
 * `CheckTestEligibilityUseCase`, or the settings screen shows usage read from a doc the server
 * has stopped writing to for a paid-tier user with a known `startDate`.
 */
class GetMonthlyUsageUseCaseTest {

    private val subscriptionRepository = FakeSubscriptionRepository()
    private val useCase = GetMonthlyUsageUseCase(subscriptionRepository)

    @Test
    fun `paid tier with a startDate queries by the anniversary period key`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.startDateResult = Result.success(1_700_000_000_000L)

        useCase("user-1")

        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(2, period?.count { it == '-' }, "expected a yyyy-MM-dd anniversary key, got $period")
    }

    @Test
    fun `FREE tier queries by the legacy calendar-month key`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.startDateResult = Result.success(null)

        useCase("user-1")

        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(1, period?.count { it == '-' }, "expected a yyyy-MM key, got $period")
    }

    @Test
    fun `a tier read failure fails open to FREE rather than throwing`() = runTest {
        subscriptionRepository.tierResult = Result.failure(Exception("offline"))

        val result = useCase("user-1")

        assertEquals(true, result.isSuccess)
        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(1, period?.count { it == '-' }, "expected a yyyy-MM key, got $period")
    }
}
