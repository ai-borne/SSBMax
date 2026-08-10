@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.tat

import com.ssbmax.shared.domain.model.EntryType
import com.ssbmax.shared.domain.model.Gender
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TATPhase
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitTATTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.usecase.tat.LoadTATTestUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.testing.clearForTest
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionAnalysisTrigger
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeTestSessionRepository
import com.ssbmax.shared.presentation.testing.FakeTestUsageRecorder
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
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
 * Characterization test, written before converting [TATTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan). Pins
 * the current state-machine behaviour (eligibility -> load -> viewing/writing
 * per-picture phases -> submit) so the conversion is provably
 * behaviour-preserving.
 */
class TATTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var testContentRepository: FakeTestContentRepository
    private lateinit var testSessionRepository: FakeTestSessionRepository
    private lateinit var userProfileRepository: FakeUserProfileRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var usageRecorder: FakeTestUsageRecorder
    private lateinit var analysisTrigger: FakeSubmissionAnalysisTrigger

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        testContentRepository = FakeTestContentRepository()
        testSessionRepository = FakeTestSessionRepository()
        userProfileRepository = FakeUserProfileRepository(
            initialProfile = UserProfile(
                userId = "test-user-1", fullName = "Test User", age = 24,
                gender = Gender.MALE, entryType = EntryType.GRADUATE
            )
        )
        submissionRepository = FakeSubmissionRepository()
        usageRecorder = FakeTestUsageRecorder()
        analysisTrigger = FakeSubmissionAnalysisTrigger()
        // "TAT" is limit 0 on FREE (SubscriptionLimits) -- default to PRO so
        // tests are eligible unless a test explicitly overrides to exercise LimitReached.
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.PRO)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun questions() = listOf(
        TATQuestion(id = "q1", imageUrl = "https://example.com/1.png", cardPosition = 1),
        TATQuestion(id = "q2", imageUrl = "https://example.com/2.png", cardPosition = 2)
    )

    private fun buildViewModel() = TATTestViewModel(
        loadTATTest = LoadTATTestUseCase(testContentRepository, testSessionRepository, userProfileRepository),
        submitTATTest = SubmitTATTestUseCase(submissionRepository),
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
        getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
        usageRecorder = usageRecorder,
        analysisTrigger = analysisTrigger,
        testSessionRepository = testSessionRepository,
        logger = NoOpLogger(),
        analyticsTracker = RecordingAnalyticsTracker()
    )

    @Test
    fun `unauthenticated access is blocked`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(TestError.AUTH_REQUIRED, viewModel.uiState.value.error)
    }

    @Test
    fun `limit reached surfaces subscription details without loading questions`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult =
            Result.success(mapOf("TAT" to UsageInfo(used = 1, limit = 1)))
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isLimitReached)
        assertTrue(state.questions.isEmpty())
    }

    @Test
    fun `incomplete profile surfaces isProfileIncomplete`() = runTest(testDispatcher) {
        userProfileRepository.profileFlow.value = Result.success(null)
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isProfileIncomplete)
    }

    @Test
    fun `loads test and enters INSTRUCTIONS phase with questions`() = runTest(testDispatcher) {
        testContentRepository.oirQuestionsResult // no-op touch to keep fake explicit
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            loadTATTest = LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            submitTATTest = SubmitTATTestUseCase(submissionRepository),
            observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
            checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
            getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
            usageRecorder = usageRecorder,
            analysisTrigger = analysisTrigger,
            testSessionRepository = testSessionRepository,
            logger = NoOpLogger(),
            analyticsTracker = RecordingAnalyticsTracker()
        )

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals(2, state.questions.size)
        assertEquals(TATPhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `startTest enters IMAGE_VIEWING and starts the viewing timer`() = runTest(testDispatcher) {
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            SubmitTATTestUseCase(submissionRepository), ObserveCurrentUserUseCase(authRepository),
            CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()), GetSubscriptionTierUseCase(subscriptionRepository), usageRecorder,
            analysisTrigger, testSessionRepository, NoOpLogger(), RecordingAnalyticsTracker()
        )
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startTest()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(TATPhase.IMAGE_VIEWING, state.phase)
        assertTrue(state.isTimerActive)
        // TAT's viewing/writing timers use a real-wall-clock endTime (see
        // TATTestViewModel.startViewingTimer), not a virtual-time-friendly counter. runTest()'s
        // own end-of-test cleanup drains the shared test scheduler to idle regardless of what this
        // test body calls explicitly, which would spin trying to catch that job up to real elapsed
        // time. Now that TATTestViewModel is a real androidx.lifecycle.ViewModel there's no public
        // close() to cancel the scope with -- clearForTest() (see ViewModelTestUtils.kt) forces
        // onCleared() via a throwaway ViewModelStore so cleanup is instant.
        viewModel.clearForTest()
    }

    // TAT_Impr_3 Phase 4: submitTest must persist the exact questions the user saw so the
    // analysis paths can recover the questionId -> imageUrl mapping instead of re-fetching a
    // fresh random 12 (the "0 bytes" image bug).
    @Test
    fun `submitTest persists the questions the user saw in the submission`() = runTest(testDispatcher) {
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            SubmitTATTestUseCase(submissionRepository), ObserveCurrentUserUseCase(authRepository),
            CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()), GetSubscriptionTierUseCase(subscriptionRepository), usageRecorder,
            analysisTrigger, testSessionRepository, NoOpLogger(), RecordingAnalyticsTracker()
        )
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val submitted = submissionRepository.lastTATSubmission
        assertNotNull(submitted)
        assertEquals(questions(), submitted.questions)
    }

    @Test
    fun `submitTest builds a submission and records usage and triggers analysis`() = runTest(testDispatcher) {
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            SubmitTATTestUseCase(submissionRepository), ObserveCurrentUserUseCase(authRepository),
            CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()), GetSubscriptionTierUseCase(subscriptionRepository), usageRecorder,
            analysisTrigger, testSessionRepository, NoOpLogger(), RecordingAnalyticsTracker()
        )
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isSubmitted)
        assertNotNull(state.submissionId)
        assertEquals(1, usageRecorder.recorded.size)
        assertEquals(1, analysisTrigger.triggered.size)
    }

    // Regression coverage for the "stuck ACTIVE test_sessions doc" incident (fixed for PPDT/OIR
    // in a prior commit): a successful TAT submission must terminate the durable session created
    // by LoadTATTestUseCase, or retaking TAT is blocked for up to its 2-hour expiresAt window.
    @Test
    fun `submitTest completes the durable test session on success`() = runTest(testDispatcher) {
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            SubmitTATTestUseCase(submissionRepository), ObserveCurrentUserUseCase(authRepository),
            CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()), GetSubscriptionTierUseCase(subscriptionRepository), usageRecorder,
            analysisTrigger, testSessionRepository, NoOpLogger(), RecordingAnalyticsTracker()
        )
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        val sessionId = "session-1"

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(listOf(sessionId), testSessionRepository.completedSessionIds)
        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
    }

    @Test
    fun `submitTest does NOT complete the durable session when submission fails`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(testSessionRepository.completedSessionIds.isEmpty())
    }

    // Exiting a test (X button/hardware back -> pauseTest()) must abandon the durable session so
    // the user can retake TAT without waiting out its 2-hour expiresAt window -- previously TAT's
    // exit dialog navigated back directly and never touched the ViewModel at all.
    @Test
    fun `pauseTest abandons the durable test session`() = runTest(testDispatcher) {
        val fakeWithTAT = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepository {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(questions())
        }
        val viewModel = TATTestViewModel(
            LoadTATTestUseCase(fakeWithTAT, testSessionRepository, userProfileRepository),
            SubmitTATTestUseCase(submissionRepository), ObserveCurrentUserUseCase(authRepository),
            CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()), GetSubscriptionTierUseCase(subscriptionRepository), usageRecorder,
            analysisTrigger, testSessionRepository, NoOpLogger(), RecordingAnalyticsTracker()
        )
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        val sessionId = "session-1"

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(listOf(sessionId), testSessionRepository.abandonedSessionIds)
        assertTrue(testSessionRepository.completedSessionIds.isEmpty())
    }

    @Test
    fun `pauseTest with no loaded session does not touch the session repository`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
    }

    @Test
    fun `submitTest failure surfaces an error message`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isSubmitted)
        assertEquals(TestError.SUBMIT_FAILED, state.error)
    }
}
