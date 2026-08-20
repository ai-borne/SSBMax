@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation

import com.ssbmax.shared.data.repository.SubscriptionLimits
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetMonthlyUsageUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.presentation.premium.UpgradeViewModel
import com.ssbmax.shared.presentation.profile.StudentProfileViewModel
import com.ssbmax.shared.presentation.profile.UserProfileViewModel
import com.ssbmax.shared.presentation.settings.SettingsViewModel
import com.ssbmax.shared.presentation.settings.SubscriptionManagementViewModel
import com.ssbmax.shared.presentation.settings.SubscriptionTierModel
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeLogger
import com.ssbmax.shared.presentation.testing.FakeRevenueCatClient
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestProgressRepository
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
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

/**
 * Part A's actual proof of "no two consumers of [GetSubscriptionTierUseCase] can disagree" --
 * not just that each ViewModel individually reacts to a flow change (the other tests in this
 * plan already cover that per-ViewModel), but that all four override-fixed ViewModels
 * ([SettingsViewModel], [UserProfileViewModel], [StudentProfileViewModel], [UpgradeViewModel])
 * plus the already-correct, unfixed baseline ([SubscriptionManagementViewModel], which re-fetches
 * fresh on every explicit [SubscriptionManagementViewModel.loadSubscriptionData] call rather than
 * observing reactively) agree with each other, and with [SubscriptionLimits]'s per-tier table, at
 * the same moment -- for all three tiers, not just the one Pro case manually observed in the
 * original bug report.
 */
class SubscriptionTierSsotTest {

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

    @Test
    fun `FREE PRO and PREMIUM overrides agree across every tier consumer and SubscriptionLimits`() =
        runTest(testDispatcher) {
            val getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository)
            val observeCurrentUser = ObserveCurrentUserUseCase(authRepository)

            val settingsViewModel = SettingsViewModel(
                observeCurrentUser = observeCurrentUser,
                getSubscriptionTier = getSubscriptionTier,
                developerSettings = developerSettings,
                logger = FakeLogger()
            )
            val userProfileViewModel = UserProfileViewModel(
                userProfileRepository = FakeUserProfileRepository(),
                authRepository = authRepository,
                getSubscriptionTier = getSubscriptionTier,
                developerSettings = developerSettings,
                logger = FakeLogger()
            )
            val studentProfileViewModel = StudentProfileViewModel(
                userProfileRepository = FakeUserProfileRepository(),
                testProgressRepository = FakeTestProgressRepository(),
                observeCurrentUser = observeCurrentUser,
                getSubscriptionTier = getSubscriptionTier,
                developerSettings = developerSettings,
                logger = FakeLogger()
            )
            val upgradeViewModel = UpgradeViewModel(
                observeCurrentUser = observeCurrentUser,
                getSubscriptionTier = getSubscriptionTier,
                subscriptionRepository = subscriptionRepository,
                revenueCatClient = FakeRevenueCatClient(),
                developerSettings = developerSettings,
                logger = FakeLogger()
            )
            val subscriptionManagementViewModel = SubscriptionManagementViewModel(
                observeCurrentUser = observeCurrentUser,
                getSubscriptionTier = getSubscriptionTier,
                getMonthlyUsage = GetMonthlyUsageUseCase(subscriptionRepository),
                subscriptionRepository = subscriptionRepository,
                revenueCatClient = FakeRevenueCatClient(),
                logger = FakeLogger()
            )
            testDispatcher.scheduler.advanceUntilIdle()

            val cases = listOf(
                SubscriptionTier.FREE to SubscriptionOverride.FORCE_FREE,
                SubscriptionTier.PRO to SubscriptionOverride.FORCE_PRO,
                SubscriptionTier.PREMIUM to SubscriptionOverride.FORCE_PREMIUM
            )

            for ((tier, override) in cases) {
                subscriptionRepository.tierResult = Result.success(tier)
                developerSettings.setOverride(override)
                testDispatcher.scheduler.advanceUntilIdle()
                subscriptionManagementViewModel.loadSubscriptionData()
                testDispatcher.scheduler.advanceUntilIdle()

                assertEquals(tier, settingsViewModel.uiState.value.subscriptionTier, "SettingsViewModel disagreed for $tier")
                assertEquals(
                    tier,
                    userProfileViewModel.uiState.value.subscriptionTier,
                    "UserProfileViewModel disagreed for $tier"
                )
                assertEquals(
                    tier == SubscriptionTier.PREMIUM,
                    studentProfileViewModel.uiState.value.isPremium,
                    "StudentProfileViewModel disagreed for $tier"
                )
                assertEquals(tier, upgradeViewModel.uiState.value.currentTier, "UpgradeViewModel disagreed for $tier")

                val managementTier = subscriptionManagementViewModel.uiState.value.currentTier
                assertEquals(
                    SubscriptionTierModel.from(tier),
                    managementTier,
                    "SubscriptionManagementViewModel disagreed for $tier"
                )

                assertEquals(
                    SubscriptionLimits.limitFor("INTERVIEW", tier),
                    managementTier.interviewTestLimit,
                    "SubscriptionTierModel's Interview limit disagreed with SubscriptionLimits SSOT for $tier"
                )
                assertEquals(
                    SubscriptionLimits.limitFor("OIR", tier),
                    managementTier.oirTestLimit,
                    "SubscriptionTierModel's OIR limit disagreed with SubscriptionLimits SSOT for $tier"
                )
            }
        }
}
