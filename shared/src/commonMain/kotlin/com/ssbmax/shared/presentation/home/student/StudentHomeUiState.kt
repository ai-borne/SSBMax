package com.ssbmax.shared.presentation.home.student

import com.ssbmax.shared.domain.model.CacheStatus
import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.Phase2Progress
import com.ssbmax.shared.domain.usecase.dashboard.ProcessedDashboardData

/**
 * UI State for Student Home Screen. Split out of `StudentHomeViewModel.kt`
 * (same package) purely to stay under this repo's 300-line Quality Limit,
 * no behavior change from the Android original.
 */
data class StudentHomeUiState(
    val isLoading: Boolean = false,
    val userName: String = "Aspirant",
    val currentStreak: Int = 0,
    val testsCompleted: Int = 0,
    val notificationCount: Int = 0,
    val phase1Progress: Phase1Progress? = null,
    val phase2Progress: Phase2Progress? = null,
    val error: String? = null,
    // true only during the very first fetch (dashboard == null).
    // OLQDashboardCard uses this to render a LinearProgressIndicator placeholder
    // while the card structure is already visible. Cleared on success or failure.
    val isDashboardLoading: Boolean = false,
    // true while a manual pull-to-refresh is in flight; drives the rotate animation
    // on the refresh icon. Independent of isDashboardLoading.
    val isRefreshingDashboard: Boolean = false,
    val dashboard: ProcessedDashboardData? = null,
    val dashboardError: String? = null,
    val lastRefreshTime: Long? = null,
    val oirCacheStatus: CacheStatus? = null,
    val isPreparingOir: Boolean = false
)
