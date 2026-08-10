@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.ppdt

import com.ssbmax.shared.domain.model.EntryType
import com.ssbmax.shared.domain.model.Gender
import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.ppdt.LoadPPDTTestUseCase
import com.ssbmax.shared.domain.usecase.ppdt.SubmitPPDTTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeDifficultyProgressionRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionAnalysisTrigger
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeTestSessionRepository
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
 * Characterization test, written before converting [PPDTTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan). Pins
 * the current state-machine behaviour (eligibility -> load -> phases ->
 * submit) so the ViewModel/scope conversion is provably behaviour-preserving:
 * this file must pass unmodified against both the pre- and post-conversion class.
 */
class PPDTTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var testContentRepository: FakeTestContentRepository
    private lateinit var testSessionRepository: FakeTestSessionRepository
    private lateinit var userProfileRepository: FakeUserProfileRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var analysisTrigger: FakeSubmissionAnalysisTrigger
    private lateinit var difficultyProgression: FakeDifficultyProgressionRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        testContentRepository = FakeTestContentRepository().apply {
            ppdtQuestionResult = Result.success(question())
        }
        testSessionRepository = FakeTestSessionRepository()
        userProfileRepository = FakeUserProfileRepository(initialProfile = profile())
        submissionRepository = FakeSubmissionRepository()
        analysisTrigger = FakeSubmissionAnalysisTrigger()
        difficultyProgression = FakeDifficultyProgressionRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun question() = PPDTQuestion(
        id = "ppdt-1",
        imageUrl = "https://example.com/img.png",
        imageDescription = "A group of people near a river"
    )

    private fun profile() = UserProfile(
        userId = "test-user-1",
        fullName = "Test User",
        age = 24,
        gender = Gender.MALE,
        entryType = EntryType.GRADUATE
    )

    private fun buildViewModel(): PPDTTestViewModel = PPDTTestViewModel(
        loadPPDTTest = LoadPPDTTestUseCase(testContentRepository, testSessionRepository, userProfileRepository),
        submitPPDTTest = SubmitPPDTTestUseCase(
            submissionRepository, userProfileRepository,
            GetSubscriptionTierUseCase(subscriptionRepository),
            com.ssbmax.shared.presentation.testing.FakeTestUsageRecorder(),
            testSessionRepository
        ),
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
        analysisTrigger = analysisTrigger,
        difficultyProgression = difficultyProgression,
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

        val state = viewModel.uiState.value
        assertEquals(TestError.AUTH_REQUIRED, state.error)
        assertEquals(false, state.isLoading)
    }

    @Test
    fun `limit reached surfaces subscription details without loading question`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult =
            Result.success(mapOf("PPDT" to UsageInfo(used = 1, limit = 1)))
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isLimitReached)
        assertEquals(SubscriptionTier.FREE, state.subscriptionTier)
        assertEquals(null, state.session)
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
    fun `loads test successfully into INSTRUCTIONS phase`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNotNull(state.session)
        assertEquals(PPDTPhase.INSTRUCTIONS, state.currentPhase)
    }

    @Test
    fun `startTest transitions to IMAGE_VIEWING and starts the countdown`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startTest()

        val state = viewModel.uiState.value
        assertEquals(PPDTPhase.IMAGE_VIEWING, state.currentPhase)
        assertTrue(state.isTimerActive)
    }

    @Test
    fun `updateStory tracks character count and proceed eligibility`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.updateStory("short")

        val state = viewModel.uiState.value
        assertEquals(5, state.charactersCount)
        assertEquals(false, state.canProceedToNextPhase)
    }

    @Test
    fun `submitTest completes session and triggers analysis`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.updateStory("A long enough story ".repeat(20))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isSubmitted)
        assertNotNull(state.submissionId)
        assertEquals(1, analysisTrigger.triggered.size)
    }

    @Test
    fun `submitTest records difficulty performance for a valid story`() = runTest(testDispatcher) {
        difficultyProgression.recommendedDifficulty = "MEDIUM"
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.updateStory("A long enough story ".repeat(20))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, difficultyProgression.recorded.size)
        val recorded = difficultyProgression.recorded.single()
        assertEquals("PPDT", recorded.testType)
        assertEquals("MEDIUM", recorded.difficulty)
        assertEquals(100f, recorded.score)
        assertEquals(1, recorded.correctAnswers)
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

    // Regression coverage for the "stuck ACTIVE test_sessions doc" incident: exiting a test
    // (X button -> pauseTest()) must abandon the durable session so the user can retake the
    // same test type without waiting out its 2-hour expiresAt window.
    @Test
    fun `pauseTest abandons the durable test session`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest()
        testDispatcher.scheduler.advanceUntilIdle()
        val sessionId = viewModel.uiState.value.session?.sessionId
        assertNotNull(sessionId)

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(listOf(sessionId), testSessionRepository.abandonedSessionIds)
        assertEquals(true, testSessionRepository.completedSessionIds.isEmpty())
    }

    @Test
    fun `pauseTest with no loaded session does not touch the session repository`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(testSessionRepository.abandonedSessionIds.isEmpty())
    }
}
