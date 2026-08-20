package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.UsageInfo

/**
 * Use case for getting monthly test usage information.
 *
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md`): must key by the same
 * [currentPeriodKey] [CheckTestEligibilityUseCase] uses -- this use case backs
 * `SubscriptionManagementScreen`'s usage display, and reading a stale calendar-month doc while
 * eligibility checks a billing-anniversary doc would show the wrong numbers on that screen for
 * any paid-tier user with a known `startDate`. (Previously also used the device's local time
 * zone instead of UTC, which could disagree with the server's own month boundary near midnight
 * UTC -- fixed here too as part of the same UTC-consistency requirement.)
 */
class GetMonthlyUsageUseCase constructor(
    private val subscriptionRepository: SubscriptionRepository
) {
    /**
     * Get monthly usage for all test types
     * @param userId The user ID
     * @return Result containing map of test types to usage info or error
     */
    suspend operator fun invoke(userId: String): Result<Map<String, UsageInfo>> {
        val tier = subscriptionRepository.getSubscriptionTier(userId).getOrElse { SubscriptionTier.FREE }
        val startDate = subscriptionRepository.getSubscriptionStartDate(userId).getOrNull()
        val period = currentPeriodKey(tier, startDate)
        return subscriptionRepository.getMonthlyUsage(userId, period)
    }
}
