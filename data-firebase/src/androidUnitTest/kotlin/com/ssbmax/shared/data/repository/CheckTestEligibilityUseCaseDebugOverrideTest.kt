package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.platform.settings.DeveloperSettings
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Dev-subscription-override plan Phase 6: [CheckTestEligibilityUseCase] dropped its
 * `bypassSubscriptionLimits` constructor param (the old `BYPASS_SUBSCRIPTION_LIMITS`
 * `BuildConfig` escape hatch). This pins that `SubscriptionOverride.FORCE_PREMIUM`, applied through
 * [DebugOverrideSubscriptionRepository] the way production Koin wiring actually composes it, is a
 * real replacement -- eligibility comes out unlimited via the genuine repository read path, not a
 * hardcoded short-circuit.
 */
class CheckTestEligibilityUseCaseDebugOverrideTest {

    private val delegate = FakeSubscriptionRepository()
    private val developerSettings = DeveloperSettings(FakeInMemorySettings())
    private val decorator = DebugOverrideSubscriptionRepository(delegate, developerSettings)
    private val useCase = CheckTestEligibilityUseCase(
        subscriptionRepository = decorator,
        analyticsTracker = object : AnalyticsTracker {
            override fun trackEvent(name: String, params: Map<String, Any?>) = Unit
        },
        developerSettings = developerSettings
    )

    @Test
    fun `FORCE_PREMIUM through the decorator yields unlimited eligibility`() = runTest {
        // Real stored state is a FREE user already at their limit -- proves the override, not the
        // underlying data, is what flips this to eligible.
        delegate.tierResult = Result.success(SubscriptionTier.FREE)
        delegate.monthlyUsageResult = Result.success(
            mapOf("OIR" to UsageInfo(used = 1, limit = 1))
        )
        developerSettings.setOverride(SubscriptionOverride.FORCE_PREMIUM)

        val result = useCase(TestType.OIR, "user-1")

        assertTrue(result is TestEligibility.Eligible)
    }
}
