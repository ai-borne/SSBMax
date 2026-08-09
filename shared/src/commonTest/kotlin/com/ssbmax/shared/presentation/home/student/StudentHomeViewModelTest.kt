package com.ssbmax.shared.presentation.home.student

import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeNotificationRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeTestProgressRepository
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
import com.ssbmax.shared.presentation.testing.RecordingAnalyticsTracker
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/**
 * Characterization test, written before converting [StudentHomeViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan). Must
 * pass unmodified against both the pre- and post-conversion class.
 */
class StudentHomeViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var userProfileRepository: FakeUserProfileRepository
    private lateinit var testProgressRepository: FakeTestProgressRepository
    private lateinit var notificationRepository: FakeNotificationRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var analyticsTracker: RecordingAnalyticsTracker

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        userProfileRepository = FakeUserProfileRepository()
        testProgressRepository = FakeTestProgressRepository()
        notificationRepository = FakeNotificationRepository()
        submissionRepository = FakeSubmissionRepository()
        analyticsTracker = RecordingAnalyticsTracker()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = StudentHomeViewModel(
        authRepository = authRepository,
        userProfileRepository = userProfileRepository,
        testProgressRepository = testProgressRepository,
        testContentRepository = FakeTestContentRepository(),
        getOLQDashboard = GetOLQDashboardUseCase(
            submissionRepository = submissionRepository,
            gtoRepository = FakeGTORepository(),
            interviewRepository = FakeInterviewRepository(),
            logger = NoOpLogger()
        ),
        notificationRepository = notificationRepository,
        logger = NoOpLogger(),
        analyticsTracker = analyticsTracker
    )

    @Test
    fun `loads user profile name and streak`() = runTest(testDispatcher) {
        userProfileRepository.profileFlow.value = Result.success(
            UserProfile(
                userId = "test-user-1",
                fullName = "Jane Doe",
                age = 22,
                gender = com.ssbmax.shared.domain.model.Gender.FEMALE,
                entryType = com.ssbmax.shared.domain.model.EntryType.GRADUATE,
                currentStreak = 5
            )
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("Jane Doe", state.userName)
        assertEquals(5, state.currentStreak)
    }

    @Test
    fun `profile load failure surfaces error`() = runTest(testDispatcher) {
        userProfileRepository.profileFlow.value = Result.failure(Exception("boom"))
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("Failed to load profile", viewModel.uiState.value.error)
    }

    @Test
    fun `notification count reflects unread flow`() = runTest(testDispatcher) {
        val unreadFlow = MutableStateFlow(0)
        notificationRepository.unreadCountFlow = unreadFlow
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(0, viewModel.uiState.value.notificationCount)

        unreadFlow.value = 3
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(3, viewModel.uiState.value.notificationCount)
    }

    @Test
    fun `dashboard loads successfully on init`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.dashboard)
        assertEquals(false, state.isDashboardLoading)
        assertEquals(null, state.dashboardError)
    }

    @Test
    fun `dashboard cache miss on first load fires dashboard_cache_miss for Phase 7a telemetry restore`() = runTest(testDispatcher) {
        buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        // First-ever load for a user id always misses GetOLQDashboardUseCase's
        // in-memory cache -- this pins the exact restored event, not just "some event fired".
        assertEquals(listOf("dashboard_cache_miss"), analyticsTracker.events.map { it.name })
    }

    @Test
    fun `forced dashboard refresh fires dashboard_cache_miss again because forceRefresh always bypasses cache`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.refreshDashboard()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(listOf("dashboard_cache_miss", "dashboard_cache_miss"), analyticsTracker.events.map { it.name })
    }

    @Test
    fun `refreshDashboard sets refreshing flag then clears it`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.refreshDashboard()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(false, viewModel.uiState.value.isRefreshingDashboard)
        assertNotNull(viewModel.uiState.value.dashboard)
    }

    @Test
    fun `test progress aggregates completed tests count`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        // Default fakes report all tests NOT_ATTEMPTED
        assertEquals(0, viewModel.uiState.value.testsCompleted)
    }
}
