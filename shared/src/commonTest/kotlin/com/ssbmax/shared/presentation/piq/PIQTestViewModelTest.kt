@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.piq

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeBackgroundTaskScheduler
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestUsageRecorder
import com.ssbmax.shared.presentation.testing.RecordingAnalyticsTracker
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
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Characterization test, written before converting [PIQTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1). Pins the debounced-autosave-draft
 * behaviour (unlike every other ported test-taking ViewModel, an
 * unauthenticated user does NOT block the form) plus the terminal submit path.
 */
class PIQTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var usageRecorder: FakeTestUsageRecorder
    private lateinit var backgroundTaskScheduler: FakeBackgroundTaskScheduler

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        submissionRepository = FakeSubmissionRepository()
        usageRecorder = FakeTestUsageRecorder()
        backgroundTaskScheduler = FakeBackgroundTaskScheduler()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = PIQTestViewModel(
        submissionRepository = submissionRepository,
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
        usageRecorder = usageRecorder,
        logger = NoOpLogger(),
        analyticsTracker = RecordingAnalyticsTracker(),
        backgroundTaskScheduler = backgroundTaskScheduler
    )

    @Test
    fun `initialize with no logged-in user still starts a blank form`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()

        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("piq_standard", state.testId)
        assertEquals(false, state.answers.containsKey("oirNumber"))
    }

    @Test
    fun `initialize auto-fills the OIR number from the user's latest OIR submission`() = runTest(testDispatcher) {
        submissionRepository.getUserSubmissionsResult = Result.success(listOf(mapOf("id" to "OIR-42")))
        val viewModel = buildViewModel()

        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("OIR-42", viewModel.uiState.value.answers["oirNumber"])
    }

    @Test
    fun `updateField autosaves as a draft after the debounce window`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.updateField("fullName", "Cadet Singh")
        testDispatcher.scheduler.advanceTimeBy(2001)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("Cadet Singh", state.answers["fullName"])
        assertNotNull(state.lastSavedAt)
        assertEquals(false, state.isSaving)
    }

    @Test
    fun `navigateToPage and goToReview update currentPage and review flag`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.navigateToPage(com.ssbmax.shared.domain.model.PIQPage.PAGE_2)
        viewModel.goToReview()

        val state = viewModel.uiState.value
        assertEquals(com.ssbmax.shared.domain.model.PIQPage.PAGE_2, state.currentPage)
        assertTrue(state.showReviewScreen)
    }

    @Test
    fun `submitTest blocked when eligibility limit is reached`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult =
            Result.success(mapOf("PIQ" to UsageInfo(used = 1, limit = 1)))
        val viewModel = buildViewModel()
        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isLimitReached)
        assertEquals(false, state.submissionComplete)
    }

    @Test
    fun `submitTest succeeds and records usage`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.updateField("fullName", "Cadet Singh")

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.submissionComplete)
        assertNotNull(state.submissionId)
        assertEquals(1, usageRecorder.recorded.size)
        // Gap #14 (Phase 8, KMP-convergence plan): a successful PIQ submission pre-warms
        // Interview-module questions so the interview starts instantly.
        assertEquals(listOf(state.submissionId), backgroundTaskScheduler.questionGenerationRequests)
    }

    @Test
    fun `submitTest failure surfaces an error message`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.initialize("piq_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.submissionComplete)
        assertEquals(TestError.SUBMIT_FAILED, state.error)
    }
}
