package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * Repository interface for subscription management
 * Provides access to subscription tier and usage data
 */
interface SubscriptionRepository {

    /**
     * Get the user's current subscription tier
     * @param userId The user ID
     * @return The user's subscription tier
     */
    suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier>

    /**
     * Get monthly usage information for all test types
     * @param userId The user ID
     * @param month The month in yyyy-MM format
     * @return Map of test type names to usage information (used count and limit)
     */
    suspend fun getMonthlyUsage(userId: String, month: String): Result<Map<String, UsageInfo>>

    /**
     * Update the user's subscription tier
     * @param userId The user ID
     * @param tier The new subscription tier
     * @return Result indicating success or failure
     */
    suspend fun updateSubscriptionTier(userId: String, tier: SubscriptionTier): Result<Unit>

    /**
     * The user's subscription start date (epoch millis), if known. Null for FREE tier (never
     * purchased) or before a purchase webhook has populated it (Phase 3/4,
     * `docs/plans/SubscriptionPricingRestructure.md`). Drives the billing-anniversary usage-reset
     * key -- see [com.ssbmax.shared.domain.usecase.subscription.currentPeriodKey].
     */
    suspend fun getSubscriptionStartDate(userId: String): Result<Long?>
}

/**
 * Usage information for a specific test type
 */
data class UsageInfo(
    val used: Int,
    val limit: Int
) {
    val isUnlimited: Boolean get() = limit == -1
    val remaining: Int get() = if (isUnlimited) Int.MAX_VALUE else (limit - used).coerceAtLeast(0)
    val percentageUsed: Float get() = if (isUnlimited) 0f else (used.toFloat() / limit.toFloat() * 100f).coerceIn(0f, 100f)
}
