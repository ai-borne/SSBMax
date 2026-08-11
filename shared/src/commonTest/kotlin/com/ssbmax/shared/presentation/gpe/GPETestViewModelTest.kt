@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.gpe

import com.ssbmax.shared.domain.model.GPEPhase
import com.ssbmax.shared.domain.model.GPEQuestion
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.gto.common.GTOEligibilityChecker
import com.ssbmax.shared.presentation.gto.common.GTOSubmissionCoordinator
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionAnalysisTrigger
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
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
 * Characterization test, written before converting [GPETestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1c). Same eligibility/submission
 * structure as `GDTestViewModelTest`/`LecturetteTestViewModelTest`, with a
 * single-question load instead of a topic/topic-choices load.
 */
class GPETestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var gtoRepository: FakeGTORepository
    private lateinit var usageRecorder: FakeTestUsageRecorder
    private lateinit var testContentRepository: FakeTestContentRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var analysisTrigger: FakeSubmissionAnalysisTrigger

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        gtoRepository = FakeGTORepository()
        usageRecorder = FakeTestUsageRecorder()
        testContentRepository = FakeTestContentRepository()
        submissionRepository = FakeSubmissionRepository()
        analysisTrigger = FakeSubmissionAnalysisTrigger()
        // "GTO" is limit 0 on FREE (SubscriptionLimits) -- default to PRO so
        // tests are eligible unless a test explicitly overrides to exercise LimitReached.
        subscriptionRepository.tierResult = Result.success(com.ssbmax.shared.domain.model.SubscriptionTier.PRO)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun question() = GPEQuestion(
        id = "q1", imageUrl = "https://example.com/gpe.png", scenario = "scenario text",
        solution = null, imageDescription = "A river crossing scenario", minCharacters = 50
    )

    private fun buildViewModel(): GPETestViewModel {
        val logger = NoOpLogger()
        val eligibilityChecker = GTOEligibilityChecker(
            observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
            getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
            gtoRepository = gtoRepository,
            checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
            logger = logger,
            analyticsTracker = RecordingAnalyticsTracker()
        )
        val submissionCoordinator = GTOSubmissionCoordinator(
            gtoRepository = gtoRepository,
            usageRecorder = usageRecorder,
            analysisTrigger = analysisTrigger,
            logger = logger
        )
        return GPETestViewModel(
            testContentRepository = testContentRepository,
            submissionRepository = submissionRepository,
            eligibilityChecker = eligibilityChecker,
            submissionCoordinator = submissionCoordinator,
            logger = logger
        )
    }

    @Test
    fun `loadTest surfaces an error when no scenarios are found`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNotNull(state.error)
    }

    @Test
    fun `loadTest surfaces limit reached without loading a scenario`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(com.ssbmax.shared.domain.model.SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("GTO" to com.ssbmax.shared.domain.repository.UsageInfo(used = 1, limit = 1))
        )
        val viewModel = buildViewModel()

        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.limitReached)
        assertEquals(1, state.limitReached?.limit)
        assertEquals(false, state.isLoading)
        assertEquals(null, state.question)
    }

    @Test
    fun `loadTest loads the scenario when eligible`() = runTest(testDispatcher) {
        testContentRepository.gpeQuestionsResult = Result.success(listOf(question()))
        val viewModel = buildViewModel()

        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNotNull(state.question)
        assertEquals(GPEPhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `startTest moves to planning phase and starts the timer`() = runTest(testDispatcher) {
        testContentRepository.gpeQuestionsResult = Result.success(listOf(question()))
        val viewModel = buildViewModel()
        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startTest()

        val state = viewModel.uiState.value
        assertEquals(GPEPhase.PLANNING, state.phase)
        assertEquals(600, state.timeRemaining)
    }

    @Test
    fun `onPlanningResponseChanged gates proceeding on minCharacters`() = runTest(testDispatcher) {
        testContentRepository.gpeQuestionsResult = Result.success(listOf(question()))
        val viewModel = buildViewModel()
        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()

        viewModel.onPlanningResponseChanged("short")
        assertEquals(false, viewModel.uiState.value.canProceedToNextPhase)

        viewModel.onPlanningResponseChanged("a".repeat(60))
        assertTrue(viewModel.uiState.value.canProceedToNextPhase)
    }

    @Test
    fun `submitTest completes and records usage plus progress`() = runTest(testDispatcher) {
        testContentRepository.gpeQuestionsResult = Result.success(listOf(question()))
        val viewModel = buildViewModel()
        viewModel.loadTest("gpe_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startTest()
        viewModel.onPlanningResponseChanged("a".repeat(60))
        viewModel.proceedToReview()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isCompleted)
        assertEquals(GPEPhase.SUBMITTED, state.phase)
        assertNotNull(state.submissionId)
        assertTrue(usageRecorder.recorded.isNotEmpty())
        assertTrue(analysisTrigger.triggeredCalls.isNotEmpty())
    }
}
