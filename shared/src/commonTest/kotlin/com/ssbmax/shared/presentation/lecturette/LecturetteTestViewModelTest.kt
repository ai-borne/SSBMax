@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.lecturette

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
 * Characterization test, written before converting [LecturetteTestViewModel]
 * to `androidx.lifecycle.ViewModel` (Phase 1c). Structurally a near-twin of
 * `GDTestViewModelTest` (see that class's doc comment) plus the extra
 * TOPIC_SELECTION phase.
 */
class LecturetteTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var gtoRepository: FakeGTORepository
    private lateinit var testContentRepository: FakeTestContentRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var analysisTrigger: FakeSubmissionAnalysisTrigger

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        gtoRepository = FakeGTORepository()
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

    private fun buildViewModel(): LecturetteTestViewModel {
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
            analysisTrigger = analysisTrigger,
            logger = logger
        )
        return LecturetteTestViewModel(
            testContentRepository = testContentRepository,
            submissionRepository = submissionRepository,
            eligibilityChecker = eligibilityChecker,
            submissionCoordinator = submissionCoordinator,
            logger = logger
        )
    }

    @Test
    fun `loadTest loads topic choices when eligible`() = runTest(testDispatcher) {
        testContentRepository.getRandomLecturetteTopicsResult = Result.success(listOf("topic-a", "topic-b"))
        val viewModel = buildViewModel()

        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals(listOf("topic-a", "topic-b"), state.topicChoices)
        assertEquals(LecturettePhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `loadTest surfaces limit reached without loading topics`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(com.ssbmax.shared.domain.model.SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("GTO" to com.ssbmax.shared.domain.repository.UsageInfo(used = 1, limit = 1))
        )
        val viewModel = buildViewModel()

        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.limitReached)
        assertEquals(1, state.limitReached?.limit)
        assertEquals(false, state.isLoading)
        assertEquals(emptyList(), state.topicChoices)
    }

    @Test
    fun `selectTopic moves to speech phase and starts the timer`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.proceedToTopicSelection()

        viewModel.selectTopic("topic A")

        val state = viewModel.uiState.value
        assertEquals(LecturettePhase.SPEECH, state.phase)
        assertEquals("topic A", state.selectedTopic)
        assertEquals(180, state.timeRemaining)
    }

    @Test
    fun `proceedToReview rejects a transcript shorter than the minimum`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.proceedToTopicSelection()
        viewModel.selectTopic("topic A")
        viewModel.onTranscriptChanged("short")

        viewModel.proceedToReview()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertEquals(LecturettePhase.SPEECH, state.phase)
    }

    @Test
    fun `submitTest completes and records usage plus progress`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.proceedToTopicSelection()
        viewModel.selectTopic("topic A")
        viewModel.onTranscriptChanged("a".repeat(100))
        viewModel.proceedToReview()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isCompleted)
        assertEquals(LecturettePhase.SUBMITTED, state.phase)
        assertNotNull(state.submissionId)
        assertTrue(gtoRepository.recordedUsage.isNotEmpty())
        assertTrue(analysisTrigger.triggeredCalls.isNotEmpty())
    }

    @Test
    fun `timer counts down one second at a time during speech`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_lecturette_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.proceedToTopicSelection()
        viewModel.selectTopic("topic A")
        val initial = viewModel.uiState.value.timeRemaining

        testDispatcher.scheduler.advanceTimeBy(1_000)
        testDispatcher.scheduler.runCurrent()

        assertEquals(initial - 1, viewModel.uiState.value.timeRemaining)
    }
}
