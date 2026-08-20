package com.ssbmax.shared.ui.home.student

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.TestPhase
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.presentation.home.student.StudentHomeViewModel
import com.ssbmax.shared.ui.permissions.LocalNotificationPermissionController
import org.koin.compose.viewmodel.koinViewModel

/**
 * Student Home Screen with Phase Progress Ribbon — Phase 5 KMP port of the
 * Android original (`app/.../ui/home/student/StudentHomeScreen.kt`).
 *
 * Shows progress for Phase 1 and Phase 2 with quick access to tests. Stats
 * cards, quick-action rows, top bar, and list content are extracted into
 * [StudentHomeSections.kt] (same package) purely to keep this file under this
 * repo's 300-line Quality Limit and Detekt method-length thresholds.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentHomeScreen(
    onNavigateToTopic: (topicId: String, selectedTab: Int) -> Unit,
    onNavigateToPhaseDetail: (TestPhase) -> Unit,
    onNavigateToStudy: () -> Unit,
    onNavigateToSubmissions: () -> Unit = {},
    onNavigateToTests: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToMarketplace: () -> Unit = {},
    onNavigateToAnalytics: () -> Unit = {},
    onNavigateToResult: (TestType, String) -> Unit,
    onOpenDrawer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val viewModel = koinViewModel<StudentHomeViewModel>()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val notificationPermissionController = LocalNotificationPermissionController.current

    // Request notification permission once on home screen load. Covers TAT,
    // WAT, SRT, SDT, PPDT -- all workers deliver results via local
    // notification. Best-effort: proceeds regardless of grant/deny.
    LaunchedEffect(Unit) {
        notificationPermissionController.request()
    }

    val actions = remember(
        onNavigateToPhaseDetail,
        onNavigateToTopic,
        onNavigateToResult,
        onNavigateToTests,
        onNavigateToSubmissions,
        onOpenDrawer,
        onNavigateToMarketplace,
        onNavigateToAnalytics,
        onNavigateToStudy
    ) {
        StudentHomeActions(
            onNavigateToPhaseDetail = onNavigateToPhaseDetail,
            onNavigateToTopic = onNavigateToTopic,
            onRefreshDashboard = { viewModel.refreshDashboard() },
            onNavigateToResult = onNavigateToResult,
            onNavigateToTests = onNavigateToTests,
            onNavigateToSubmissions = onNavigateToSubmissions,
            onOpenDrawer = onOpenDrawer,
            onNavigateToMarketplace = onNavigateToMarketplace,
            onNavigateToAnalytics = onNavigateToAnalytics,
            onNavigateToStudy = onNavigateToStudy
        )
    }

    Scaffold(
        topBar = {
            StudentHomeTopBar(
                userName = uiState.userName,
                notificationCount = uiState.notificationCount,
                onOpenDrawer = onOpenDrawer,
                onNavigateToNotifications = onNavigateToNotifications
            )
        }
    ) { paddingValues ->
        StudentHomeScrollableContent(
            uiState = uiState,
            actions = actions,
            modifier = modifier.padding(paddingValues)
        )
    }
}
