@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.wat

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.WATPhase
import com.ssbmax.shared.domain.model.WATWord
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitWATTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.domain.util.ObservabilitySeam
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.testing.clearForTest
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionAnalysisTrigger
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeTestSessionRepository
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
 * Characterization test, written before converting [WATTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1). Pins the current one-phase,
 * one-timer-per-word state machine (load -> per-word timer -> auto-submit).
 */
class WATTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var testContentRepository: com.ssbmax.shared.domain.repository.TestContentRepository
    private lateinit var testSessionRepository: FakeTestSessionRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var usageRecorder: FakeTestUsageRecorder
    private lateinit var analysisTrigger: FakeSubmissionAnalysisTrigger
    private lateinit var analyticsTracker: RecordingAnalyticsTracker

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        testContentRepository = FakeTestContentRepository().let { fake ->
            object : com.ssbmax.shared.domain.repository.TestContentRepository by fake {
                override suspend fun getWATQuestions(testId: String) = Result.success(words())
            }
        }
        testSessionRepository = FakeTestSessionRepository()
        submissionRepository = FakeSubmissionRepository()
        usageRecorder = FakeTestUsageRecorder()
        analysisTrigger = FakeSubmissionAnalysisTrigger()
        analyticsTracker = RecordingAnalyticsTracker()
        // "WAT" is limit 0 on FREE (SubscriptionLimits) -- default to PRO so
        // tests are eligible unless a test explicitly overrides to exercise LimitReached.
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun words() = listOf(
        WATWord(id = "w1", word = "Duty", sequenceNumber = 1),
        WATWord(id = "w2", word = "Honor", sequenceNumber = 2)
    )

    private fun buildViewModel() = WATTestViewModel(
        testContentRepository = testContentRepository,
        testSessionRepository = testSessionRepository,
        submitWATTest = SubmitWATTestUseCase(submissionRepository),
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
        usageRecorder = usageRecorder,
        analysisTrigger = analysisTrigger,
        observability = ObservabilitySeam(NoOpLogger(), analyticsTracker)
    )

    @Test
    fun `unauthenticated access is blocked`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(TestError.AUTH_REQUIRED, viewModel.uiState.value.error)
        assertEquals(listOf(com.ssbmax.shared.domain.util.SecurityEvents.UNAUTHENTICATED_ACCESS), analyticsTracker.events.map { it.name })
    }

    @Test
    fun `limit reached surfaces subscription details`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult =
            Result.success(mapOf("WAT" to UsageInfo(used = 1, limit = 1)))
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isLimitReached)
    }

    @Test
    fun `loads test into INSTRUCTIONS phase with words`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(2, state.words.size)
        assertEquals(WATPhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `startTest enters IN_PROGRESS and starts the word timer`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(WATPhase.IN_PROGRESS, state.phase)
        assertTrue(state.isTimerActive)
        // WAT's per-word timer uses a real-wall-clock endTime (see WATTestViewModel.startWordTimer),
        // not a virtual-time-friendly counter, and moveToNextWord()'s terminal branch never cancels
        // a still-running timerJob. runTest()'s own end-of-test cleanup drains the shared test
        // scheduler to idle regardless of what this test body calls explicitly, which would spin
        // trying to catch that job up to real elapsed time. Now that WATTestViewModel is a real
        // androidx.lifecycle.ViewModel there's no public close() to cancel the scope with --
        // clearForTest() (see ViewModelTestUtils.kt) forces onCleared() via a throwaway
        // ViewModelStore so cleanup is instant.
        viewModel.clearForTest()
    }

    @Test
    fun `submitResponse advances to the next word`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.updateResponse("Sacrifice")
        viewModel.submitResponse()
        testDispatcher.scheduler.runCurrent()

        assertEquals(1, viewModel.uiState.value.currentWordIndex)
        viewModel.clearForTest() // see the timer note in the first test
    }

    @Test
    fun `completing the last word auto-submits and triggers analysis`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()
        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertTrue(state.isSubmitted)
        assertNotNull(state.submissionId)
        assertEquals(1, usageRecorder.recorded.size)
        assertEquals(1, analysisTrigger.triggered.size)
        viewModel.clearForTest() // see the timer note in the first test
    }

    @Test
    fun `submitTest failure surfaces a typed error not raw exception text`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()
        submissionRepository.submitResult = Result.failure(Exception("PERMISSION_DENIED: Missing or insufficient permissions."))

        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()
        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(false, state.isSubmitted)
        assertEquals(TestError.SUBMIT_FAILED, state.error)
        viewModel.clearForTest() // see the timer note in the first test
    }

    // Regression coverage for the "stuck ACTIVE test_sessions doc" incident (fixed for PPDT/OIR
    // in a prior commit): a successful WAT submission must terminate the durable session created
    // by loadTest(), or retaking WAT is blocked for up to its 2-hour expiresAt window.
    @Test
    fun `completing the last word completes the durable test session`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()
        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()

        assertEquals(listOf("session-1"), testSessionRepository.completedSessionIds)
        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
        viewModel.clearForTest() // see the timer note in the first test
    }

    @Test
    fun `submitTest failure does NOT complete the durable session`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()
        viewModel.skipWord()
        testDispatcher.scheduler.runCurrent()

        assertTrue(testSessionRepository.completedSessionIds.isEmpty())
        viewModel.clearForTest() // see the timer note in the first test
    }

    // Exiting a test (X button/hardware back -> pauseTest()) must abandon the durable session so
    // the user can retake WAT without waiting out its 2-hour expiresAt window -- previously WAT's
    // exit dialog navigated back directly and never touched the ViewModel at all.
    @Test
    fun `pauseTest abandons the durable test session`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(listOf("session-1"), testSessionRepository.abandonedSessionIds)
        assertTrue(testSessionRepository.completedSessionIds.isEmpty())
    }

    @Test
    fun `pauseTest with no loaded session does not touch the session repository`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
    }
}
