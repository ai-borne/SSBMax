package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.data.repository.SubscriptionLimits
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.platform.settings.DeveloperSettings

/**
 * KMP port of the eligibility half of the Android `core:data`
 * `SubscriptionManager.canTakeTest` (the other half — [TestUsageRecorder]'s
 * `recordTestUsage` — already had a domain interface; this use case is new
 * for Phase 5's OIR test-taking port, since nothing in `shared` previously
 * needed to gate *starting* a test, only recording usage after one).
 *
 * Known, deliberate deviations from the Android original (both documented,
 * not silent):
 * - No local Room mirror of usage (the Android original also synced
 *   `TestUsageDao`) — `shared` has no equivalent cache table for this data;
 *   Firestore is read directly every time, matching this repo's own
 *   "SECURITY: reads from Firestore server-side to prevent bypass" comment
 *   (the Room sync was a read-path optimization, not a security requirement).
 *   Confirmed safe to drop outright (KMP-convergence Phase 9d): `core:data`'s
 *   `TestUsageDao` was written by `canTakeTest`/`recordTestUsage` but had zero
 *   readers anywhere except `SubscriptionManager`'s own dead
 *   `getTotalTestsUsedThisMonth` (itself grep-confirmed to have zero callers)
 *   — the mirror was already load-bearing for nothing.
 * - `SecurityEventLogger`'s limit-reached event is restored (Phase 7a) via
 *   the injected [AnalyticsTracker] — [SecurityEvents.LIMIT_REACHED], the one
 *   call `core:data`'s Android-only `SecurityEventLogger` made from this
 *   exact decision point.
 *
 * The debug-only `BYPASS_SUBSCRIPTION_LIMITS` `BuildConfig` escape hatch this use case once
 * accepted as a `bypassSubscriptionLimits` constructor param (Android-only, never wired on iOS) was
 * retired by the dev-subscription-override plan's Phase 6. `SubscriptionOverride.FORCE_PREMIUM`
 * (via [developerSettings], both platforms) replaces it: `data-firebase`'s
 * `DebugOverrideSubscriptionRepository` maps every [SubscriptionRepository] read this use case makes
 * onto the forced tier, so eligibility genuinely reaches the same "no meaningful limit" outcome
 * through the real lookup path rather than a hardcoded short-circuit.
 */
class CheckTestEligibilityUseCase(
    private val subscriptionRepository: SubscriptionRepository,
    private val analyticsTracker: AnalyticsTracker,
    private val developerSettings: DeveloperSettings? = null
) {
    suspend operator fun invoke(testType: TestType, userId: String): TestEligibility {
        val tier = subscriptionRepository.getSubscriptionTier(userId).getOrElse {
            return TestEligibility.NetworkError
        }
        // Fails open to null (not NetworkError) -- this is an optimistic client-side pre-check,
        // and a missing/unreadable startDate should just fall back to the calendar-month key
        // (currentPeriodKey's own FREE-tier fallback), not block eligibility outright.
        val startDate = subscriptionRepository.getSubscriptionStartDate(userId).getOrNull()
        val period = currentPeriodKey(tier, startDate)
        val usage = subscriptionRepository.getMonthlyUsage(userId, period).getOrElse {
            return TestEligibility.NetworkError
        }
        val key = SubscriptionLimits.keyFor(testType)
        val info = usage[key]
        val limit = info?.limit ?: SubscriptionLimits.limitFor(key, tier)
        val used = info?.used ?: 0

        return if (limit == -1 || used < limit) {
            TestEligibility.Eligible(remainingTests = if (limit == -1) Int.MAX_VALUE else limit - used)
        } else {
            // Suppressed while a dev tier override is active -- toggling Force Free to see the
            // limit-reached dialog isn't a real user hitting a real limit, and shouldn't pollute
            // production security-event metrics.
            val isOverridden = developerSettings?.getOverride()?.let { it != SubscriptionOverride.FOLLOW_REAL } ?: false
            if (!isOverridden) {
                analyticsTracker.trackEvent(
                    SecurityEvents.LIMIT_REACHED,
                    mapOf("test_type" to testType.name, "tier" to tier.name)
                )
            }
            TestEligibility.LimitReached(
                tier = tier,
                limit = limit,
                usedCount = used,
                resetsAt = nextResetLabel(tier, startDate)
            )
        }
    }
}
