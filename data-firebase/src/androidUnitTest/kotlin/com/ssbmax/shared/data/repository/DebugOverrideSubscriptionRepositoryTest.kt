package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.platform.settings.DeveloperSettings
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Pins the Phase 3 (KMP-convergence plan) invariants this decorator exists for: overriding tier
 * alone would leave enforced limits untouched (`getMonthlyUsage` bakes tier into each `limit`), so
 * both reads must move together; and toggling the setting must change behavior without
 * reconstructing the repository (it's a Koin single).
 *
 * The two `updateSubscriptionTier` pass-through tests that used to live here went away with the
 * method itself in Phase 1 of the Payment Ecosystem Hardening plan (finding C1) -- there is no
 * client-side tier write left for this decorator to pass through.
 */
class DebugOverrideSubscriptionRepositoryTest {

    private val delegate = FakeSubscriptionRepository()
    private val developerSettings = DeveloperSettings(FakeInMemorySettings())
    private val repository = DebugOverrideSubscriptionRepository(delegate, developerSettings)

    @Test
    fun `FOLLOW_REAL passes getSubscriptionTier through unchanged`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.PRO)

        assertEquals(Result.success(SubscriptionTier.PRO), repository.getSubscriptionTier("user-1"))
    }

    @Test
    fun `FOLLOW_REAL passes getMonthlyUsage through unchanged`() = runTest {
        delegate.monthlyUsageResult = Result.success(mapOf("OIR" to UsageInfo(used = 1, limit = 1)))

        assertEquals(delegate.monthlyUsageResult, repository.getMonthlyUsage("user-1", "2026-08"))
    }

    @Test
    fun `FORCE_FREE overrides getSubscriptionTier regardless of delegate`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.PREMIUM)
        developerSettings.setOverride(SubscriptionOverride.FORCE_FREE)

        assertEquals(Result.success(SubscriptionTier.FREE), repository.getSubscriptionTier("user-1"))
    }

    @Test
    fun `FORCE_PRO overrides getSubscriptionTier regardless of delegate`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.FREE)
        developerSettings.setOverride(SubscriptionOverride.FORCE_PRO)

        assertEquals(Result.success(SubscriptionTier.PRO), repository.getSubscriptionTier("user-1"))
    }

    @Test
    fun `FORCE_PREMIUM overrides getSubscriptionTier regardless of delegate`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.FREE)
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        assertEquals(Result.success(SubscriptionTier.PREMIUM), repository.getSubscriptionTier("user-1"))
    }

    @Test
    fun `override remaps limit but preserves real used count`() = runTest {
        delegate.monthlyUsageResult = Result.success(
            mapOf(
                "OIR" to UsageInfo(used = 1, limit = 1),
                "INTERVIEW" to UsageInfo(used = 2, limit = 1)
            )
        )
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        val usage = repository.getMonthlyUsage("user-1", "2026-08").getOrThrow()

        assertEquals(1, usage.getValue("OIR").used)
        assertEquals(15, usage.getValue("OIR").limit)
        assertEquals(2, usage.getValue("INTERVIEW").used)
        assertEquals(10, usage.getValue("INTERVIEW").limit)
    }

    /**
     * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md`): `startDate` is never faked by an
     * override -- a dev forcing PREMIUM with no real purchase has no real start date, and
     * `currentPeriodKey` already falls back to the calendar-month key for a null `startDate`
     * regardless of tier, so there's nothing for this decorator to remap here.
     */
    @Test
    fun `getSubscriptionStartDate always passes through regardless of override`() = runTest {
        delegate.startDateResult = Result.success(1_700_000_000_000L)
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        assertEquals(Result.success(1_700_000_000_000L), repository.getSubscriptionStartDate("user-1"))
    }

    /** Same rationale as `getSubscriptionStartDate` above -- a forced tier has no real webhook
     * behind it, so there's no ownership to fake; the dual-purchase gate must only react to a
     * real Razorpay/RevenueCat write, never a debug override. */
    @Test
    fun `getSubscriptionOwnership always passes through regardless of override`() = runTest {
        delegate.ownershipResult = Result.success(SubscriptionOwnership(source = "RAZORPAY", expiryDate = null))
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        assertEquals(
            Result.success(SubscriptionOwnership(source = "RAZORPAY", expiryDate = null)),
            repository.getSubscriptionOwnership("user-1")
        )
    }

    @Test
    fun `toggling the setting changes behavior without reconstruction`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.FREE)
        assertEquals(Result.success(SubscriptionTier.FREE), repository.getSubscriptionTier("user-1"))

        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        assertEquals(Result.success(SubscriptionTier.PREMIUM), repository.getSubscriptionTier("user-1"))
    }
}
