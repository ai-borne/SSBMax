package com.ssbmax.navigation

import androidx.navigation.compose.composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import com.ssbmax.shared.ui.premium.UpgradeScreen
import com.ssbmax.shared.ui.profile.StudentProfileScreen
import com.ssbmax.shared.ui.profile.UserProfileScreen
import com.ssbmax.shared.ui.settings.SettingsScreen
import com.ssbmax.shared.ui.settings.SubscriptionManagementScreen

fun NavGraphBuilder.profileSettingsGraph(navController: NavHostController) {
    // Profile vertical. UserProfileScreen (create/edit form)
    // replaces the earlier NotYetPortedScreen placeholder -- Splash's
    // onNavigateToProfileOnboarding still lands here (isOnboarding defaults
    // false; `SSBMaxDestinations.UserProfile(isOnboarding = true)` is a real,
    // constructible instance now, but nothing in this graph navigates to it
    // yet -- Splash always navigates to the plain default-arg instance).
    composable<SSBMaxDestinations.UserProfile> {
        UserProfileScreen(
            onNavigateBack = { navController.navigateUp() },
            onProfileSaved = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.UserProfile> { inclusive = true }
                }
            }
        )
    }

    // StudentProfile (summary/stats display, distinct from UserProfile's
    // create/edit form above). Settings/achievements/history callbacks
    // route to Settings (ported) and the honest placeholder respectively --
    // there is no ported AchievementsScreen/TestHistoryScreen yet.
    composable<SSBMaxDestinations.StudentProfile> {
        val notYetPorted: (String) -> Unit = { screen ->
            navController.navigate(SSBMaxDestinations.NotYetPorted(screen))
        }
        StudentProfileScreen(
            onNavigateToSettings = { navController.navigate(SSBMaxDestinations.Settings) },
            onNavigateToAchievements = { notYetPorted("AchievementsScreen") },
            onNavigateToHistory = {
                navController.navigate(SSBMaxDestinations.HistoricResults)
            }
        )
    }

    // Settings vertical. onNavigateToFAQ routes to the honest placeholder --
    // there is no ported FAQScreen yet. onNavigateToUpgrade/
    // onNavigateToSubscriptionManagement route to the real UpgradeScreen/
    // SubscriptionManagementScreen registered below.
    composable<SSBMaxDestinations.Settings> {
        val notYetPorted: (String) -> Unit = { screen ->
            navController.navigate(SSBMaxDestinations.NotYetPorted(screen))
        }
        SettingsScreen(
            onNavigateBack = { navController.navigateUp() },
            onNavigateToFAQ = { notYetPorted("FAQScreen") },
            onNavigateToUpgrade = {
                navController.navigate(SSBMaxDestinations.UpgradeScreen)
            },
            onNavigateToSubscriptionManagement = {
                navController.navigate(SSBMaxDestinations.SubscriptionManagement)
            }
        )
    }

    // Subscription Management. onUpgrade routes to the real UpgradeScreen
    // below, the single tier-comparison surface (SubscriptionManagementScreen
    // no longer renders its own comparison grid -- see that screen's class
    // doc). [UpgradeScreen] itself is "visual only" (see its own class doc):
    // PlayBillingClient/StoreKitBillingClient exist as Phase 4 shims but
    // are NOT wired into SubscriptionManager -- a known, separately-tracked
    // gap that matches the Android original having no working purchase
    // flow either (its own upgrade button just shows a "Coming Soon" dialog).
    composable<SSBMaxDestinations.SubscriptionManagement> {
        SubscriptionManagementScreen(
            onNavigateBack = { navController.navigateUp() },
            onUpgrade = { navController.navigate(SSBMaxDestinations.UpgradeScreen) }
        )
    }

    // Premium Upgrade screen -- the KMP port of the Android LIVE
    // `com.ssbmax.ui.premium.UpgradeScreen` (route "premium/upgrade"). See
    // [UpgradeScreen]'s own class doc for why the sibling Android
    // `com.ssbmax.ui.upgrade`/`com.ssbmax.ui.payment` packages (dead code,
    // unreachable from any Android nav graph) were NOT ported.
    composable<SSBMaxDestinations.UpgradeScreen> {
        UpgradeScreen(
            onNavigateBack = { navController.navigateUp() }
        )
    }
}
