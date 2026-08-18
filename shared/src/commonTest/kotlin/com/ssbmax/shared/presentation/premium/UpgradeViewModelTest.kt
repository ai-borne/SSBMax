@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.premium

import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
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
import kotlin.test.assertTrue

/**
 * Characterization test for [UpgradeViewModel], written retroactively (13-VM
 * gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the
 * current-tier load + static plan list + "visual only" upgrade-dialog flow
 * (no payment gateway wired, see the ViewModel's own doc comment).
 */
class UpgradeViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var developerSettings: DeveloperSettings

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        developerSettings = DeveloperSettings(FakeSettings())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = UpgradeViewModel(
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
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
    fun `upgradeToPlan shows the coming-soon dialog without a real purchase flow`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.upgradeToPlan(SubscriptionTier.PREMIUM)

        val state = viewModel.uiState.value
        assertTrue(state.showComingSoonDialog)
        assertEquals(SubscriptionTier.PREMIUM, state.selectedPlanForUpgrade)
    }

    @Test
    fun `dismissComingSoonDialog clears the dialog state`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.upgradeToPlan(SubscriptionTier.PRO)

        viewModel.dismissComingSoonDialog()

        val state = viewModel.uiState.value
        assertEquals(false, state.showComingSoonDialog)
        assertEquals(null, state.selectedPlanForUpgrade)
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
}
