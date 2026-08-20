package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.RecordingAnalyticsTracker
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Phase 7a (KMP-convergence plan): pins the restored `sec_limit_reached`
 * security-event telemetry — the one `core:data` `SecurityEventLogger` call
 * this use case's own doc comment flagged as dropped during the KMP port.
 */
class CheckTestEligibilityUseCaseTest {

    private val subscriptionRepository = FakeSubscriptionRepository()
    private val analyticsTracker = RecordingAnalyticsTracker()
    private val useCase = CheckTestEligibilityUseCase(subscriptionRepository, analyticsTracker)

    @Test
    fun `eligible user fires no security event`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("TAT" to UsageInfo(used = 0, limit = 3))
        )

        val result = useCase(TestType.TAT, "user-1")

        assertTrue(result is TestEligibility.Eligible)
        assertTrue(analyticsTracker.events.isEmpty())
    }

    @Test
    fun `limit reached fires sec_limit_reached with test type and tier`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("OIR" to UsageInfo(used = 1, limit = 1))
        )

        val result = useCase(TestType.OIR, "user-1")

        assertTrue(result is TestEligibility.LimitReached)
        assertEquals(1, analyticsTracker.events.size)
        val event = analyticsTracker.events.single()
        assertEquals(SecurityEvents.LIMIT_REACHED, event.name)
        assertEquals("OIR", event.params["test_type"])
        assertEquals("FREE", event.params["tier"])
    }

    @Test
    fun `network error fires no security event`() = runTest {
        subscriptionRepository.tierResult = Result.failure(Exception("offline"))

        val result = useCase(TestType.OIR, "user-1")

        assertTrue(result is TestEligibility.NetworkError)
        assertTrue(analyticsTracker.events.isEmpty())
    }

    /**
     * Phase 3 (KMP-convergence plan): a dev toggling Force Free to see the limit-reached dialog
     * isn't a real user hitting a real limit -- firing `sec_limit_reached` for that would pollute
     * production security-event metrics with dev-session noise.
     */
    @Test
    fun `limit reached while overridden does not fire security event`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("OIR" to UsageInfo(used = 1, limit = 1))
        )
        val developerSettings = DeveloperSettings(FakeSettings())
        developerSettings.setOverride(SubscriptionOverride.FORCE_FREE)
        val overriddenUseCase = CheckTestEligibilityUseCase(
            subscriptionRepository = subscriptionRepository,
            analyticsTracker = analyticsTracker,
            developerSettings = developerSettings
        )

        val result = overriddenUseCase(TestType.OIR, "user-1")

        assertTrue(result is TestEligibility.LimitReached)
        assertTrue(analyticsTracker.events.isEmpty())
    }

    /** FOLLOW_REAL is not an override -- the event must still fire, same as the no-DeveloperSettings case. */
    @Test
    fun `limit reached with FOLLOW_REAL still fires security event`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("OIR" to UsageInfo(used = 1, limit = 1))
        )
        val developerSettings = DeveloperSettings(FakeSettings())
        val followRealUseCase = CheckTestEligibilityUseCase(
            subscriptionRepository = subscriptionRepository,
            analyticsTracker = analyticsTracker,
            developerSettings = developerSettings
        )

        val result = followRealUseCase(TestType.OIR, "user-1")

        assertTrue(result is TestEligibility.LimitReached)
        assertEquals(1, analyticsTracker.events.size)
    }

    /**
     * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): a paid tier with a known
     * `startDate` must query usage by the billing-anniversary key (`yyyy-MM-dd`, 2 dashes), not
     * the legacy calendar-month key (`yyyy-MM`, 1 dash) -- exact date coverage of the anniversary
     * math itself lives in `BillingPeriodTest` with an injectable clock; this only pins that
     * `CheckTestEligibilityUseCase` actually wires `startDate` through to the query.
     */
    @Test
    fun `paid tier with a known startDate queries usage by the anniversary period key`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.startDateResult = Result.success(1_700_000_000_000L)
        subscriptionRepository.monthlyUsageResult = Result.success(mapOf("TAT" to UsageInfo(used = 0, limit = 3)))

        useCase(TestType.TAT, "user-1")

        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(2, period?.count { it == '-' }, "expected a yyyy-MM-dd anniversary key, got $period")
    }

    /** FREE tier has no `startDate` -- must keep querying the legacy calendar-month key. */
    @Test
    fun `FREE tier queries usage by the legacy calendar-month key`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.startDateResult = Result.success(null)
        subscriptionRepository.monthlyUsageResult = Result.success(mapOf("OIR" to UsageInfo(used = 0, limit = 1)))

        useCase(TestType.OIR, "user-1")

        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(1, period?.count { it == '-' }, "expected a yyyy-MM key, got $period")
    }

    /** A `getSubscriptionStartDate` failure must fail open to the calendar-month fallback, not `NetworkError`. */
    @Test
    fun `startDate read failure falls back to calendar-month key not NetworkError`() = runTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.startDateResult = Result.failure(Exception("offline"))
        subscriptionRepository.monthlyUsageResult = Result.success(mapOf("TAT" to UsageInfo(used = 0, limit = 3)))

        val result = useCase(TestType.TAT, "user-1")

        assertTrue(result is TestEligibility.Eligible)
        val period = subscriptionRepository.lastMonthlyUsagePeriod
        assertEquals(1, period?.count { it == '-' }, "expected a yyyy-MM key, got $period")
    }
}
