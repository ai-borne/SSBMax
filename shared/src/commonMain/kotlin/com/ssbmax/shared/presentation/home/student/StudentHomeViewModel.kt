package com.ssbmax.shared.presentation.home.student

import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.model.Phase2Progress
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.NotificationRepository
import com.ssbmax.shared.domain.repository.TestProgressRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.DomainLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Clock

/**
 * ViewModel for the Student Home Screen — Phase 5 KMP port of the Android
 * original (`app/.../ui/home/student/StudentHomeViewModel.kt`).
 *
 * A real `androidx.lifecycle.ViewModel` using `viewModelScope` (Phase 1 of
 * the KMP-convergence plan) — the screen uses `koinViewModel()`, not
 * `koinInject()`.
 *
 * Deviations from the Android original, all deliberate and documented (none
 * silent):
 * - `unifiedResultRepository` constructor param dropped: grep-confirmed the
 *   Android original never actually reads it anywhere in the class body —
 *   dead code, not carried forward (matches this plan's own "don't
 *   manufacture new dead code" precedent from Phase 2).
 * - `analyticsManager: com.ssbmax.core.data.analytics.AnalyticsManager`
 *   replaced with the injected [AnalyticsTracker] (Phase 7a of the
 *   KMP-convergence plan) — the three `trackFeatureUsed` calls this port
 *   would have made (`dashboard_cache_hit`/`dashboard_cache_miss`/
 *   `dashboard_cache_error`) are restored in [loadDashboard], reading
 *   [com.ssbmax.shared.domain.usecase.dashboard.CacheMetadata.cacheHit] off
 *   [GetOLQDashboardUseCase]'s own result rather than re-deriving it.
 * - `ErrorLogger` (Android-only: `android.util.Log` + Firebase Crashlytics)
 *   replaced with the injected [DomainLogger], the same cross-platform
 *   logging seam [GetOLQDashboardUseCase] and every other ported
 *   ViewModel in this phase already uses (bound to a real platform impl as
 *   of Phase 7a, not a no-op).
 * - `System.currentTimeMillis()` (JVM-only) -> `Clock.System.now().toEpochMilliseconds()`.
 */
class StudentHomeViewModel(
    private val authRepository: AuthRepository,
    private val userProfileRepository: UserProfileRepository,
    private val testProgressRepository: TestProgressRepository,
    private val testContentRepository: TestContentRepository,
    private val getOLQDashboard: GetOLQDashboardUseCase,
    private val notificationRepository: NotificationRepository,
    private val logger: DomainLogger,
    private val analyticsTracker: AnalyticsTracker
) : ViewModel() {
    private val tag = "StudentHomeViewModel"

    private val _uiState = MutableStateFlow(StudentHomeUiState())
    val uiState: StateFlow<StudentHomeUiState> = _uiState.asStateFlow()

    init {
        observeUserProfile()
        observeTestProgress()
        observeNotifications()
        prepareOirCache()
        loadDashboard(forceRefresh = false) // Use cache on initial load
    }

    private fun observeUserProfile() {
        viewModelScope.launch {
            try {
                val currentUser = authRepository.currentUser.value
                if (currentUser != null) {
                    userProfileRepository.getUserProfile(currentUser.id)
                        .stateIn(
                            scope = viewModelScope,
                            started = SharingStarted.WhileSubscribed(5000),
                            initialValue = Result.success(null)
                        )
                        .collect { result ->
                            result.onSuccess { profile ->
                                _uiState.update {
                                    it.copy(
                                        userName = profile?.fullName ?: "Aspirant",
                                        currentStreak = profile?.currentStreak ?: 0,
                                        error = null
                                    )
                                }
                            }.onFailure { error ->
                                logger.e(tag, "Failed to load user profile for user ${currentUser.id}", error)
                                _uiState.update { it.copy(error = "Failed to load profile") }
                            }
                        }
                }
            } catch (e: Exception) {
                logger.e(tag, "Unexpected error in observeUserProfile", e)
                _uiState.update { it.copy(error = "Failed to load profile") }
            }
        }
    }

    private fun observeTestProgress() {
        viewModelScope.launch {
            try {
                val userId = authRepository.currentUser.value?.id ?: return@launch

                val fallback = Pair(
                    Phase1Progress(
                        oirProgress = TestProgress(TestType.OIR),
                        ppdtProgress = TestProgress(TestType.PPDT)
                    ),
                    Phase2Progress(
                        psychologyProgress = TestProgress(TestType.TAT),
                        gtoProgress = TestProgress(TestType.GTO_GD),
                        interviewProgress = TestProgress(TestType.IO)
                    )
                )

                combine(
                    testProgressRepository.getPhase1Progress(userId),
                    testProgressRepository.getPhase2Progress(userId)
                ) { phase1, phase2 -> Pair(phase1, phase2) }
                    .catch { error ->
                        logger.e(tag, "Failed to load test progress for user $userId", error)
                        emit(fallback)
                    }
                    .stateIn(
                        scope = viewModelScope,
                        started = SharingStarted.WhileSubscribed(5000),
                        initialValue = fallback
                    )
                    .collect { (phase1, phase2) ->
                        val allProgress = listOf(
                            phase1.oirProgress,
                            phase1.ppdtProgress,
                            phase2.psychologyProgress,
                            phase2.gtoProgress,
                            phase2.interviewProgress
                        )

                        val completedTests = allProgress.count { progress ->
                            progress.status != TestStatus.NOT_ATTEMPTED
                        }

                        _uiState.update {
                            it.copy(
                                phase1Progress = phase1,
                                phase2Progress = phase2,
                                testsCompleted = completedTests
                            )
                        }
                    }
            } catch (e: Exception) {
                logger.e(tag, "Unexpected error in observeTestProgress", e)
            }
        }
    }

    /**
     * Observe notification count from repository. Updates UI state with
     * real-time unread notification count.
     */
    private fun observeNotifications() {
        viewModelScope.launch {
            try {
                authRepository.currentUser.collectLatest { user ->
                    if (user != null) {
                        notificationRepository.getUnreadCount(user.id)
                            .catch { error ->
                                logger.e(tag, "Failed to load notification count for user ${user.id}", error)
                                emit(0) // Graceful degradation
                            }
                            .collectLatest { count ->
                                _uiState.update { it.copy(notificationCount = count) }
                            }
                    } else {
                        _uiState.update { it.copy(notificationCount = 0) }
                    }
                }
            } catch (e: Exception) {
                logger.e(tag, "Unexpected error in observeNotifications", e)
                _uiState.update { it.copy(notificationCount = 0) }
            }
        }
    }

    private fun prepareOirCache() {
        viewModelScope.launch {
            val user = authRepository.currentUser.value ?: return@launch
            _uiState.update { it.copy(isPreparingOir = true) }
            testContentRepository.initializeOIRCache()
                .onFailure { logger.e(tag, "OIR cache preparation failed for user ${user.id}", it) }
            _uiState.update {
                it.copy(
                    isPreparingOir = false,
                    oirCacheStatus = testContentRepository.getOIRCacheStatus()
                )
            }
        }
    }

    fun retryOirPreparation() {
        prepareOirCache()
    }

    fun refreshProgress() {
        // Flows are already observing, just re-trigger by reinitializing observers
        observeUserProfile()
        observeTestProgress()
        loadDashboard(forceRefresh = true) // Force fresh data from Firestore
    }

    /** Refresh only the dashboard (used by refresh button) */
    fun refreshDashboard() {
        loadDashboard(forceRefresh = true)
    }

    private fun loadDashboard(forceRefresh: Boolean = false) {
        viewModelScope.launch {
            try {
                if (forceRefresh) {
                    // Manual refresh: drive the rotate-icon animation only.
                    // OLQDashboardCard is already visible -- do not set isDashboardLoading.
                    _uiState.update {
                        it.copy(isRefreshingDashboard = true, dashboardError = null)
                    }
                } else if (_uiState.value.dashboard == null) {
                    // Initial fetch: card is visible but showing empty() placeholder data.
                    // Signal the card to display its LinearProgressIndicator.
                    _uiState.update {
                        it.copy(isDashboardLoading = true, dashboardError = null)
                    }
                }

                val userId = authRepository.currentUser.value?.id
                if (userId == null) {
                    _uiState.update {
                        it.copy(
                            isDashboardLoading = false,
                            isRefreshingDashboard = false,
                            dashboardError = "Please login to view progress"
                        )
                    }
                    return@launch
                }

                // No umbrella timeout here: GetOLQDashboardUseCase isolates each test-type fetch
                // under its own per-type budget and returns a partial dashboard (with
                // unavailableTypes populated) rather than failing wholesale.
                getOLQDashboard(userId, forceRefresh)
                    .onSuccess { processedData ->
                        analyticsTracker.trackEvent(
                            if (processedData.cacheMetadata.cacheHit) "dashboard_cache_hit" else "dashboard_cache_miss"
                        )
                        _uiState.update {
                            it.copy(
                                isDashboardLoading = false,
                                isRefreshingDashboard = false,
                                dashboard = processedData,
                                lastRefreshTime = Clock.System.now().toEpochMilliseconds(),
                                dashboardError = null
                            )
                        }
                    }
                    .onFailure { error ->
                        logger.e(tag, "Failed to load dashboard for user $userId", error)
                        analyticsTracker.trackEvent("dashboard_cache_error")
                        _uiState.update {
                            it.copy(
                                isDashboardLoading = false,
                                isRefreshingDashboard = false,
                                dashboardError = error.message ?: "Failed to load dashboard"
                            )
                        }
                    }
            } catch (e: Exception) {
                logger.e(tag, "Unexpected error in loadDashboard", e)
                _uiState.update {
                    it.copy(
                        isDashboardLoading = false,
                        isRefreshingDashboard = false,
                        dashboardError = "Unexpected error: ${e.message}"
                    )
                }
            }
        }
    }
}
