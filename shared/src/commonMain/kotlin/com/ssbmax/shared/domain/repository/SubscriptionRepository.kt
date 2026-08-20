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

    // There is deliberately NO client-side tier write here. `updateSubscriptionTier` was removed in
    // Phase 1 of the Payment Ecosystem Hardening plan (finding C1): it depended on a Firestore rule
    // that let any signed-in user write their own `users/{uid}/data/subscription` doc -- i.e. grant
    // themselves PREMIUM for free. The rule is now closed (firestore.rules, pinned by
    // firestore-tests/user_data.rules.test.mjs), so any such write would fail at runtime anyway.
    // Tier is written by the payment webhooks ONLY (functions/src/webhooks.js for Razorpay,
    // functions/src/revenueCatWebhook.js for RevenueCat), both via the Admin SDK. If a UI needs to
    // feel instant after a purchase, update its own local UiState -- do not reintroduce a write path.

    /**
     * The user's subscription start date (epoch millis), if known. Null for FREE tier (never
     * purchased) or before a purchase webhook has populated it (Phase 3/4,
     * `docs/plans/SubscriptionPricingRestructure.md`). Drives the billing-anniversary usage-reset
     * key -- see [com.ssbmax.shared.domain.usecase.subscription.currentPeriodKey].
     */
    suspend fun getSubscriptionStartDate(userId: String): Result<Long?>

    /**
     * Which payment path last granted the user's current tier, plus its expiry -- used by
     * [com.ssbmax.shared.presentation.premium.UpgradeViewModel]'s dual-purchase gate. Neither
     * `webhooks.js` (Razorpay/web) nor `revenueCatWebhook.js` (RevenueCat/mobile) reconciles
     * against what the other already wrote to `data/subscription` -- last write wins -- so a user
     * who is already paying through one path is blocked from starting a second, separate
     * subscription through the other rather than silently risking one webhook stomping the other.
     */
    suspend fun getSubscriptionOwnership(userId: String): Result<SubscriptionOwnership>
}

/**
 * @param source `"RAZORPAY"`/`"REVENUECAT"`/null (never purchased, or a doc predating this field).
 * @param expiryDate Epoch millis, or null (Razorpay's one-time-order path never tracks an expiry --
 * a null expiry from that source means "perpetual until the next webhook," not "unknown").
 * @param willRenew Whether the subscription auto-renews at `expiryDate` (Phase B, Razorpay
 * Subscriptions API migration). Defaults `true` -- see [com.ssbmax.shared.data.repository.SubscriptionTierDto.willRenew].
 */
data class SubscriptionOwnership(
    val source: String?,
    val expiryDate: Long?,
    val willRenew: Boolean = true
) {
    /** @param nowMillis epoch millis to compare against -- passed in rather than read internally
     * so this stays a pure function testable without mocking a clock. */
    fun isActive(nowMillis: Long): Boolean = expiryDate == null || expiryDate > nowMillis
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
