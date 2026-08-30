package com.ssbmax.shared.ui.components.drawer

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.UserProfile

/**
 * KMP port of the Android `app/.../ui/components/drawer/SSBMaxDrawer.kt` --
 * combines [DrawerHeader] and [DrawerContent] into the drawer's full
 * scrollable body. See [com.ssbmax.shared.ui.components.SSBMaxAppScaffold]
 * for where this is hosted inside a `ModalNavigationDrawer`.
 */
@Composable
fun SSBMaxDrawer(
    userProfile: UserProfile?,
    subscriptionTier: SubscriptionTier?,
    isLoadingProfile: Boolean = false,
    currentRoute: String,
    phase1Expanded: Boolean,
    phase2Expanded: Boolean,
    onNavigateToHome: () -> Unit,
    onNavigateToTopic: (topicId: String) -> Unit,
    onNavigateToSSBOverview: () -> Unit,
    onNavigateToMyBatches: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onEditProfile: () -> Unit,
    onTogglePhase1: () -> Unit,
    onTogglePhase2: () -> Unit,
    onSignOut: () -> Unit,
    onDeleteAccount: () -> Unit,
    isDeletionPending: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize()) {
        DrawerHeader(
            userProfile = userProfile,
            subscriptionTier = subscriptionTier,
            isLoading = isLoadingProfile,
            onEditProfile = onEditProfile
        )

        DrawerContent(
            currentRoute = currentRoute,
            phase1Expanded = phase1Expanded,
            phase2Expanded = phase2Expanded,
            onNavigateToHome = onNavigateToHome,
            onNavigateToTopic = onNavigateToTopic,
            onNavigateToSSBOverview = onNavigateToSSBOverview,
            onNavigateToMyBatches = onNavigateToMyBatches,
            onNavigateToSettings = onNavigateToSettings,
            onTogglePhase1 = onTogglePhase1,
            onTogglePhase2 = onTogglePhase2,
            onSignOut = onSignOut,
            onDeleteAccount = onDeleteAccount,
            isDeletionPending = isDeletionPending
        )
    }
}
