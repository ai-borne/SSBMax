@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.sdt

import com.ssbmax.shared.domain.model.SDTPhase
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitSDTTestUseCase
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
 * Characterization test, written before converting [SDTTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1). Pins the current state machine:
 * 4 fixed essay questions, one whole-test countdown, edit-before-submit
 * REVIEW phase.
 */
class SDTTestViewModelTest {

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
        val base = FakeTestContentRepository()
        testContentRepository = object : com.ssbmax.shared.domain.repository.TestContentRepository by base {
            override suspend fun getSDTQuestions(testId: String) = Result.success(questions())
        }
        testSessionRepository = FakeTestSessionRepository()
        submissionRepository = FakeSubmissionRepository()
        usageRecorder = FakeTestUsageRecorder()
        analysisTrigger = FakeSubmissionAnalysisTrigger()
        analyticsTracker = RecordingAnalyticsTracker()
        // "Self Description" is limit 0 on FREE (SubscriptionLimits) -- default to PRO so
        // tests are eligible unless a test explicitly overrides to exercise LimitReached.
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun questions() = listOf(
        SDTQuestion(id = "q1", question = "What do your friends think of you?", sequenceNumber = 1),
        SDTQuestion(id = "q2", question = "What do you think of yourself?", sequenceNumber = 2)
    )

    private fun buildViewModel() = SDTTestViewModel(
        testContentRepository = testContentRepository,
        testSessionRepository = testSessionRepository,
        submitSDTTest = SubmitSDTTestUseCase(submissionRepository),
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
            Result.success(mapOf("Self Description" to UsageInfo(used = 1, limit = 1)))
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isLimitReached)
    }

    @Test
    fun `loads test into INSTRUCTIONS phase with questions`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(2, state.questions.size)
        assertEquals(SDTPhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `startTest enters IN_PROGRESS and starts the countdown`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(SDTPhase.IN_PROGRESS, state.phase)
        assertTrue(state.isTimerActive)
        // SDT's countdown timer uses a real-wall-clock endTime (see SDTTestViewModel.startTimer),
        // not a virtual-time-friendly counter -- its timerJob is still running (submitTest() never
        // cancels it either). runTest()'s own end-of-test cleanup drains the shared test scheduler
        // to idle regardless of what this test body calls explicitly, which would spin trying to
        // catch that job up to real elapsed time. Now that SDTTestViewModel is a real
        // androidx.lifecycle.ViewModel there's no public close() to cancel the scope with --
        // clearForTest() (see ViewModelTestUtils.kt) forces onCleared() via a throwaway
        // ViewModelStore so cleanup is instant.
        viewModel.clearForTest()
    }

    @Test
    fun `moveToNext on the last question enters REVIEW`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.updateAnswer("I am dependable and calm under pressure.")
        viewModel.moveToNext()
        viewModel.moveToNext()

        val state = viewModel.uiState.value
        assertEquals(SDTPhase.REVIEW, state.phase)
        assertEquals(2, state.responses.size)
        viewModel.clearForTest() // see the timer note in the previous test
    }

    @Test
    fun `submitTest builds a submission and triggers analysis`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.submitTest()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertTrue(state.isSubmitted)
        assertNotNull(state.submissionId)
        assertEquals(1, analysisTrigger.triggered.size)
        viewModel.clearForTest() // see the timer note on the first startTest() test
    }

    @Test
    fun `submitTest failure surfaces a typed error not raw exception text`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()
        submissionRepository.submitResult = Result.failure(Exception("PERMISSION_DENIED: Missing or insufficient permissions."))

        viewModel.submitTest()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(false, state.isSubmitted)
        assertEquals(TestError.SUBMIT_FAILED, state.error)
        viewModel.clearForTest() // see the timer note on the first startTest() test
    }

    // Regression coverage for the "stuck ACTIVE test_sessions doc" incident (fixed for PPDT/OIR
    // in a prior commit): a successful SDT submission must terminate the durable session created
    // by loadTest(), or retaking SDT is blocked for up to its 2-hour expiresAt window.
    @Test
    fun `submitTest completes the durable test session on success`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        viewModel.submitTest()
        testDispatcher.scheduler.runCurrent()

        assertEquals(listOf("session-1"), testSessionRepository.completedSessionIds)
        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
        viewModel.clearForTest()
    }

    @Test
    fun `submitTest failure does NOT complete the durable session`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.runCurrent()

        assertTrue(testSessionRepository.completedSessionIds.isEmpty())
        viewModel.clearForTest()
    }

    // Exiting a test (X button/hardware back -> pauseTest()) must abandon the durable session so
    // the user can retake SDT without waiting out its 2-hour expiresAt window -- previously SDT's
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
