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
}
