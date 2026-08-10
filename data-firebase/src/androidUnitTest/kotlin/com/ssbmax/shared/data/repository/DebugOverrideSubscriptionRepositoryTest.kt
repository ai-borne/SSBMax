package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.platform.settings.DeveloperSettings
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Pins the Phase 3 (KMP-convergence plan) invariants this decorator exists for: overriding tier
 * alone would leave enforced limits untouched (`getMonthlyUsage` bakes tier into each `limit`), so
 * both reads must move together; `updateSubscriptionTier` must always reach the delegate regardless
 * of override (Rule 5 -- the override changes what's *read*, never what's *written*); and toggling
 * the setting must change behavior without reconstructing the repository (it's a Koin single).
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
    fun `FOLLOW_REAL passes updateSubscriptionTier through unchanged`() = runTest {
        repository.updateSubscriptionTier("user-1", SubscriptionTier.PREMIUM)

        assertEquals(listOf(SubscriptionTier.PREMIUM), delegate.updateCalls)
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
        assertEquals(-1, usage.getValue("OIR").limit)
        assertEquals(2, usage.getValue("INTERVIEW").used)
        assertEquals(3, usage.getValue("INTERVIEW").limit)
    }

    @Test
    fun `updateSubscriptionTier always reaches the delegate regardless of override`() = runTest {
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        repository.updateSubscriptionTier("user-1", SubscriptionTier.FREE)

        assertEquals(listOf(SubscriptionTier.FREE), delegate.updateCalls)
    }

    @Test
    fun `toggling the setting changes behavior without reconstruction`() = runTest {
        delegate.tierResult = Result.success(SubscriptionTier.FREE)
        assertEquals(Result.success(SubscriptionTier.FREE), repository.getSubscriptionTier("user-1"))

        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        assertEquals(Result.success(SubscriptionTier.PREMIUM), repository.getSubscriptionTier("user-1"))
    }
}
