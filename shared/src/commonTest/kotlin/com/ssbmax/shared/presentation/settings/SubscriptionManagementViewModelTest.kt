@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.settings

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetMonthlyUsageUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.billing.revenuecat.RevenueCatPurchaseOutcome
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeMobileEntitlementRepairClient
import com.ssbmax.shared.presentation.testing.FakeRevenueCatClient
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Phase 6 (payment ecosystem hardening plan): pins that the "Manage Billing" action is offered
 * only for an active RevenueCat-sourced subscription, and that a missing/unfetchable management
 * URL is a handled UI state, never a crash -- see [SubscriptionManagementScreen]'s tap handler,
 * which calls [SubscriptionManagementViewModel.onManageBillingUnavailable] in exactly that case.
 */
class SubscriptionManagementViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var revenueCatClient: FakeRevenueCatClient
    private lateinit var mobileEntitlementRepairClient: FakeMobileEntitlementRepairClient

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        revenueCatClient = FakeRevenueCatClient()
        mobileEntitlementRepairClient = FakeMobileEntitlementRepairClient()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = SubscriptionManagementViewModel(
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
        getMonthlyUsage = GetMonthlyUsageUseCase(subscriptionRepository),
        subscriptionRepository = subscriptionRepository,
        revenueCatClient = revenueCatClient,
        mobileEntitlementRepairClient = mobileEntitlementRepairClient,
        logger = NoOpLogger()
    )

    @Test
    fun `shows manage billing for an active RevenueCat-sourced subscription`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "REVENUECAT", expiryDate = null))
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"), managementUrl = "https://apps.apple.com/manage")
        )

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.showManageBilling)
        assertEquals("https://apps.apple.com/manage", state.managementUrl)
    }

    @Test
    fun `hides manage billing for a Razorpay-sourced subscription`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "RAZORPAY", expiryDate = null))

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.showManageBilling)
        assertNull(state.managementUrl)
    }

    @Test
    fun `hides manage billing for a FREE tier even if a source is set`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "REVENUECAT", expiryDate = null))

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        assertFalse(viewModel.uiState.value.showManageBilling)
    }

    @Test
    fun `RevenueCat-sourced subscription with no management URL is a handled state not a crash`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "REVENUECAT", expiryDate = null))
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"), managementUrl = null)
        )

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.showManageBilling)
        assertNull(state.managementUrl)
        assertFalse(state.manageBillingError)

        viewModel.onManageBillingUnavailable()
        assertTrue(viewModel.uiState.value.manageBillingError)

        viewModel.dismissManageBillingError()
        assertFalse(viewModel.uiState.value.manageBillingError)
    }

    @Test
    fun `a failed RevenueCat fetch does not crash and leaves manage billing without a URL`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "REVENUECAT", expiryDate = null))
        revenueCatClient.purchaseResult = Result.failure(RuntimeException("network error"))

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNull(state.error)
        assertTrue(state.showManageBilling)
        assertNull(state.managementUrl)
    }

    /**
     * Phase 7 (payment ecosystem hardening plan): the "paid but locked out" case this phase
     * exists for -- Firestore reads FREE (a missed grant webhook), but RevenueCat's own SDK
     * already reports an active PRO entitlement. The screen must trigger the repair callable so
     * the next visit shows the corrected tier, and it must pass RevenueCat's tier as a diagnostic
     * claim only -- the callable itself (not this ViewModel) is what re-verifies server-side.
     */
    @Test
    fun `triggers entitlement repair when RevenueCat reports a higher tier than Firestore has on record`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"))
        )

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, mobileEntitlementRepairClient.repairCallCount)
        assertEquals(SubscriptionTier.PRO, mobileEntitlementRepairClient.lastClaimedTier)
    }

    @Test
    fun `does not trigger entitlement repair when RevenueCat and Firestore already agree`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "REVENUECAT", expiryDate = null))
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"))
        )

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(0, mobileEntitlementRepairClient.repairCallCount)
    }

    @Test
    fun `does not trigger entitlement repair when RevenueCat reports a lower tier than what is stored -- never a client-side downgrade signal`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PREMIUM)
        subscriptionRepository.ownershipResult =
            Result.success(SubscriptionOwnership(source = "RAZORPAY", expiryDate = null))
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("basic"))
        )

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(0, mobileEntitlementRepairClient.repairCallCount)
    }

    @Test
    fun `a repair failure is logged and does not affect the already-rendered screen state`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"))
        )
        mobileEntitlementRepairClient.repairResult = Result.failure(RuntimeException("repair rejected"))

        val viewModel = buildViewModel()
        viewModel.loadSubscriptionData()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, mobileEntitlementRepairClient.repairCallCount)
        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNull(state.error)
    }
}
