@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.premium

import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.billing.BillingCancelledException
import com.ssbmax.shared.platform.billing.SSBMaxProductIds
import com.ssbmax.shared.platform.billing.revenuecat.RevenueCatProductPrice
import com.ssbmax.shared.platform.billing.revenuecat.RevenueCatPurchaseOutcome
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeRevenueCatClient
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.testUser
import com.ssbmax.shared.ui.theme.TierColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Characterization test for [UpgradeViewModel], written retroactively (13-VM
 * gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the
 * current-tier load + static plan list + (Phase 4, RevenueCat integration)
 * the real purchase flow through a fake [com.ssbmax.shared.platform.billing.revenuecat.RevenueCatClient].
 */
class UpgradeViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var revenueCatClient: FakeRevenueCatClient
    private lateinit var developerSettings: DeveloperSettings

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        revenueCatClient = FakeRevenueCatClient()
        developerSettings = DeveloperSettings(FakeSettings())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = UpgradeViewModel(
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
        subscriptionRepository = subscriptionRepository,
        revenueCatClient = revenueCatClient,
        developerSettings = developerSettings,
        logger = NoOpLogger()
    )

    @Test
    fun `loads current subscription tier and available plans on init`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals(SubscriptionTier.PRO, state.currentTier)
        assertEquals(4, state.availablePlans.size)
    }

    @Test
    fun `defaults to FREE tier when no user is logged in`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(SubscriptionTier.FREE, state.currentTier)
        assertEquals(false, state.isLoading)
    }

    @Test
    fun `selectBillingCycle updates the selected cycle`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.selectBillingCycle(BillingCycle.ANNUALLY)

        assertEquals(BillingCycle.ANNUALLY, viewModel.uiState.value.selectedBillingCycle)
    }

    @Test
    fun `upgradeToPlan purchases the tier's product and persists the resulting tier`() = runTest(testDispatcher) {
        revenueCatClient.purchaseResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("basic", "pro", "premium"))
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.upgradeToPlan(SubscriptionTier.PREMIUM)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(SSBMaxProductIds.PREMIUM_MONTHLY, revenueCatClient.lastPurchasedProductId)
        assertEquals(testUser().id to SubscriptionTier.PREMIUM, subscriptionRepository.lastUpdatedTierCall)
        val state = viewModel.uiState.value
        assertEquals(false, state.isPurchasing)
        assertEquals(null, state.purchaseError)
        assertEquals(SubscriptionTier.PREMIUM, state.currentTier)
    }

    @Test
    fun `upgradeToPlan surfaces a non-cancellation purchase failure as an error`() = runTest(testDispatcher) {
        revenueCatClient.purchaseResult = Result.failure(Exception("Product not found in current offering"))
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.upgradeToPlan(SubscriptionTier.PRO)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isPurchasing)
        assertEquals("Product not found in current offering", state.purchaseError)
        assertEquals(null, subscriptionRepository.lastUpdatedTierCall)
    }

    @Test
    fun `upgradeToPlan treats user cancellation as a silent no-op, not an error`() = runTest(testDispatcher) {
        revenueCatClient.purchaseResult = Result.failure(BillingCancelledException())
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.upgradeToPlan(SubscriptionTier.PRO)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isPurchasing)
        assertEquals(null, state.purchaseError)
    }

    @Test
    fun `dismissPurchaseError clears the error state`() = runTest(testDispatcher) {
        revenueCatClient.purchaseResult = Result.failure(Exception("boom"))
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.upgradeToPlan(SubscriptionTier.PRO)
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.dismissPurchaseError()

        assertEquals(null, viewModel.uiState.value.purchaseError)
    }

    @Test
    fun `restorePurchases persists the restored tier and clears isRestoring`() = runTest(testDispatcher) {
        revenueCatClient.restoreResult = Result.success(
            RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("basic", "pro"))
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.restorePurchases()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, revenueCatClient.restoreCallCount)
        assertEquals(testUser().id to SubscriptionTier.PRO, subscriptionRepository.lastUpdatedTierCall)
        val state = viewModel.uiState.value
        assertEquals(false, state.isRestoring)
        assertEquals(SubscriptionTier.PRO, state.currentTier)
    }

    @Test
    fun `restorePurchases surfaces a failure as purchaseError`() = runTest(testDispatcher) {
        revenueCatClient.restoreResult = Result.failure(Exception("network down"))
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.restorePurchases()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isRestoring)
        assertEquals("network down", state.purchaseError)
    }

    @Test
    fun `loads RevenueCat store prices per tier on init, keyed by domain tier not product ID`() =
        runTest(testDispatcher) {
            revenueCatClient.offeringPricesResult = Result.success(
                mapOf(
                    SSBMaxProductIds.BASIC_MONTHLY to RevenueCatProductPrice("₹299.00", 299_000_000, "INR"),
                    SSBMaxProductIds.PRO_MONTHLY to RevenueCatProductPrice("₹499.00", 499_000_000, "INR")
                )
            )
            val viewModel = buildViewModel()
            testDispatcher.scheduler.advanceUntilIdle()

            val prices = viewModel.uiState.value.storeFormattedPrices
            assertEquals("₹299.00", prices[SubscriptionTier.BASIC])
            assertEquals("₹499.00", prices[SubscriptionTier.PRO])
            assertEquals(null, prices[SubscriptionTier.PREMIUM])
            assertEquals(null, prices[SubscriptionTier.FREE])
        }

    @Test
    fun `a failed store-price fetch leaves storeFormattedPrices empty, not an error`() = runTest(testDispatcher) {
        revenueCatClient.offeringPricesResult = Result.failure(Exception("offline"))
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(emptyMap(), state.storeFormattedPrices)
        assertEquals(null, state.purchaseError)
    }

    @Test
    fun `each available plan's gradient comes from TierColors, not a hand-typed literal`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val plans = viewModel.uiState.value.availablePlans
        for (tier in SubscriptionTier.entries) {
            val plan = plans.first { it.tier == tier }
            assertEquals(TierColors.gradient(tier), plan.gradient)
        }
    }

    @Test
    fun `override change alone with no auth change triggers a refetch`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(SubscriptionTier.FREE, viewModel.uiState.value.currentTier)

        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
        developerSettings.setOverride(SubscriptionOverride.FORCE_PRO)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(SubscriptionTier.PRO, viewModel.uiState.value.currentTier)
    }

    @Test
    fun `auth-state change alone with no override triggers a refetch`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(SubscriptionTier.FREE, viewModel.uiState.value.currentTier)

        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PREMIUM)
        authRepository.userFlow.value = testUser(id = "test-user-2")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(SubscriptionTier.PREMIUM, viewModel.uiState.value.currentTier)
    }

    /**
     * Phase 4 amendment (dual-purchase gate): neither `webhooks.js` (Razorpay/web) nor
     * `revenueCatWebhook.js` (RevenueCat/mobile) reconciles against what the other already wrote
     * to `data/subscription` -- last write wins. A user who bought PRO on web via Razorpay and
     * then triggers a mobile RC purchase would have one webhook silently stomp the other's
     * tier/expiry. `activeOnWebInstead` must reflect an active Razorpay-sourced tier so the UI can
     * block the second purchase before it happens.
     */
    @Test
    fun `flags activeOnWebInstead when an active Razorpay subscription already exists`() = runTest(testDispatcher) {
        subscriptionRepository.ownershipResult = Result.success(
            SubscriptionOwnership(source = "RAZORPAY", expiryDate = null)
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(true, viewModel.uiState.value.activeOnWebInstead)
    }

    @Test
    fun `does not flag activeOnWebInstead for an expired Razorpay subscription`() = runTest(testDispatcher) {
        subscriptionRepository.ownershipResult = Result.success(
            SubscriptionOwnership(source = "RAZORPAY", expiryDate = 1L)
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(false, viewModel.uiState.value.activeOnWebInstead)
    }

    @Test
    fun `does not flag activeOnWebInstead when the active tier is already RevenueCat-sourced`() = runTest(testDispatcher) {
        subscriptionRepository.ownershipResult = Result.success(
            SubscriptionOwnership(source = "REVENUECAT", expiryDate = null)
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(false, viewModel.uiState.value.activeOnWebInstead)
    }

    @Test
    fun `upgradeToPlan is blocked and never calls purchase when activeOnWebInstead`() = runTest(testDispatcher) {
        subscriptionRepository.ownershipResult = Result.success(
            SubscriptionOwnership(source = "RAZORPAY", expiryDate = null)
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.upgradeToPlan(SubscriptionTier.PRO)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(null, revenueCatClient.lastPurchasedProductId)
        assertEquals(null, subscriptionRepository.lastUpdatedTierCall)
        assertEquals(false, viewModel.uiState.value.isPurchasing)
    }
}
