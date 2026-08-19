package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.platform.settings.DeveloperSettings

/**
 * Debug-only decorator that lets a developer force the tier every eligibility/usage read sees,
 * without touching what's actually stored for the signed-in user.
 *
 * Overriding only [getSubscriptionTier] would leave enforced limits untouched: [delegate]'s
 * [getMonthlyUsage] independently re-fetches the real tier and bakes it into each [UsageInfo.limit],
 * and `CheckTestEligibilityUseCase` prefers that baked-in `limit` over recomputing one. Settings
 * would read "PRO" while eligibility still enforced FREE. So both reads are overridden here, kept
 * in sync by construction since both consult the same [DeveloperSettings.currentOverrideTierOrNull].
 *
 * The override only ever changes how tier is *read*. There is no write to decorate at all any
 * more: `updateSubscriptionTier` was removed from [SubscriptionRepository] in Phase 1 of the
 * Payment Ecosystem Hardening plan (finding C1) -- so a debug toggle cannot persist a fake tier to
 * a real user's Firestore document even in principle.
 *
 * [DeveloperSettings] is read live on every call, never cached at construction -- this class is a
 * Koin single built once, so caching the override here would need an app restart to pick up a
 * toggle.
 */
class DebugOverrideSubscriptionRepository(
    private val delegate: SubscriptionRepository,
    private val developerSettings: DeveloperSettings
) : SubscriptionRepository {

    override suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier> {
        val overrideTier = developerSettings.currentOverrideTierOrNull()
            ?: return delegate.getSubscriptionTier(userId)
        return Result.success(overrideTier)
    }

    override suspend fun getMonthlyUsage(userId: String, month: String): Result<Map<String, UsageInfo>> {
        val overrideTier = developerSettings.currentOverrideTierOrNull()
            ?: return delegate.getMonthlyUsage(userId, month)
        val usage = delegate.getMonthlyUsage(userId, month).getOrElse { return Result.failure(it) }
        val remapped = usage.mapValues { (key, info) ->
            info.copy(limit = SubscriptionLimits.limitFor(key, overrideTier))
        }
        return Result.success(remapped)
    }

    // Always the real value -- a forced tier with no real purchase has no real start date to fake,
    // and CheckTestEligibilityUseCase's period-key logic already falls back to calendar-month for a
    // null startDate regardless of tier.
    override suspend fun getSubscriptionStartDate(userId: String): Result<Long?> =
        delegate.getSubscriptionStartDate(userId)

    // Always the real value, same rationale as getSubscriptionStartDate --
    // a forced tier has no real purchase behind it, so there's nothing to fake ownership of; the
    // dual-purchase gate should only ever react to a real Razorpay/RevenueCat webhook write.
    override suspend fun getSubscriptionOwnership(userId: String): Result<SubscriptionOwnership> =
        delegate.getSubscriptionOwnership(userId)
}
