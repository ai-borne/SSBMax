@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.oir

import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.domain.usecase.oir.OIRTestScoreCalculator
import com.ssbmax.shared.domain.usecase.oir.SubmitOIRTestUseCase
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeOIREvaluationClient
import com.ssbmax.shared.presentation.testing.clearForTest
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
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
import kotlin.math.absoluteValue

/**
 * Characterization test, written before converting [OIRTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan's
 * strict-SSOT execution plan). Pins the current state-machine behaviour
 * (load -> answer -> navigate -> submit -> timer) so the ViewModel/scope
 * conversion is provably behaviour-preserving: this file must pass
 * unmodified against both the pre- and post-conversion class.
 */
class OIRTestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var testContentRepository: FakeTestContentRepository
    private lateinit var testSessionRepository: FakeTestSessionRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private var activeViewModel: OIRTestViewModel? = null

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        testContentRepository = FakeTestContentRepository().apply {
            oirQuestionsResult = Result.success(testQuestionSet())
        }
        testSessionRepository = FakeTestSessionRepository()
        submissionRepository = FakeSubmissionRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun runViewModelTest(block: suspend () -> Unit) = runTest(testDispatcher) {
        try {
            block()
        } finally {
            activeViewModel?.clearForTest()
            activeViewModel = null
        }
    }

    private fun testQuestionSet(): List<OIRQuestion> = buildList {
        add(question("q1", OIRQuestionType.VERBAL_REASONING))
        add(question("q2", OIRQuestionType.VERBAL_REASONING))
        repeat(18) { add(question("verbal-$it", OIRQuestionType.VERBAL_REASONING)) }
        repeat(20) { add(question("non-verbal-$it", OIRQuestionType.NON_VERBAL_REASONING)) }
        repeat(10) { add(question("numerical-$it", OIRQuestionType.NUMERICAL_ABILITY)) }
    }

    private fun question(id: String, type: OIRQuestionType) = OIRQuestion(
        id = id,
        questionNumber = id.hashCode().absoluteValue,
        type = type,
        questionText = "Which shape completes the sequence?",
        options = listOf(
            OIROption("opt_a", "Circle"),
            OIROption("opt_b", "Square"),
            OIROption("opt_c", "Triangle"),
            OIROption("opt_d", "Hexagon")
        ),
        correctAnswerId = "opt_a",
        explanation = "The pattern repeats every three shapes.",
        difficulty = QuestionDifficulty.EASY
    )

    private fun buildViewModel(): OIRTestViewModel {
        val logger = NoOpLogger()
        val submitOIRTestUseCase = SubmitOIRTestUseCase(
            evaluationClient = FakeOIREvaluationClient(),
            scoreCalculator = OIRTestScoreCalculator(logger),
            usageRecorder = FakeTestUsageRecorder(),
            dashboardUseCase = GetOLQDashboardUseCase(
                submissionRepository = submissionRepository,
                gtoRepository = FakeGTORepository(),
                interviewRepository = FakeInterviewRepository(),
                logger = logger
            ),
            submissionRepository = submissionRepository,
            testSessionRepository = testSessionRepository,
            testContentRepository = testContentRepository
        )
        return OIRTestViewModel(
            testContentRepository = testContentRepository,
            testSessionRepository = testSessionRepository,
            observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
            checkTestEligibility = CheckTestEligibilityUseCase(subscriptionRepository, RecordingAnalyticsTracker()),
            getSubscriptionTier = GetSubscriptionTierUseCase(subscriptionRepository),
            submitOIRTestUseCase = submitOIRTestUseCase,
            logger = logger,
            analyticsTracker = RecordingAnalyticsTracker()
        ).also { activeViewModel = it }
    }

    @Test
    fun `unauthenticated access is blocked`() = runViewModelTest {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(OIRErrorType.AUTH_REQUIRED, state.errorType)
        assertEquals(false, state.isLoading)
        viewModel.clearForTest()
    }

    @Test
    fun `eligibility failure blocks question loading`() = runViewModelTest {
        subscriptionRepository.tierResult = Result.failure(IllegalStateException("eligibility unavailable"))

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(OIRErrorType.QUESTIONS_UNAVAILABLE, viewModel.uiState.value.errorType)
        assertEquals(null, viewModel.uiState.value.currentQuestion)
        assertEquals(0, testContentRepository.getOIRQuestionsCallCount)
        viewModel.clearForTest()
    }

    @Test
    fun `durable session creation failure blocks question loading`() = runViewModelTest {
        testSessionRepository.createSessionResult = Result.failure(IllegalStateException("session unavailable"))

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(OIRErrorType.SESSION_UNAVAILABLE, viewModel.uiState.value.errorType)
        assertEquals(0, testContentRepository.getOIRQuestionsCallCount)
        viewModel.clearForTest()
    }

    @Test
    fun `partial question set is rejected before test starts`() = runViewModelTest {
        testContentRepository.oirQuestionsResult = Result.success(testQuestionSet().take(49))

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(OIRErrorType.QUESTIONS_UNAVAILABLE, viewModel.uiState.value.errorType)
        assertEquals(null, viewModel.uiState.value.currentQuestion)
        viewModel.clearForTest()
    }

    @Test
    fun `limit reached surfaces subscription details without loading questions`() = runViewModelTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult =
            Result.success(mapOf("OIR" to UsageInfo(used = 1, limit = 1)))

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isLimitReached)
        assertEquals(SubscriptionTier.FREE, state.subscriptionTier)
        assertEquals(1, state.testsLimit)
        assertEquals(1, state.testsUsed)
        assertEquals(null, state.currentQuestion)
        viewModel.clearForTest()
    }

    @Test
    fun `loads questions and starts timer when eligible`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNotNull(state.currentQuestion)
        assertEquals(50, state.totalQuestions)
        assertTrue(state.isTimerActive)
        viewModel.clearForTest()
    }

    @Test
    fun `selecting an option records the answer and shows feedback`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.selectOption("opt_a")

        val state = viewModel.uiState.value
        assertEquals(setOf("opt_a"), state.selectedOptionIds)
        assertTrue(state.showFeedback)
        assertTrue(state.isCurrentAnswerCorrect)
        assertTrue(state.currentQuestionAnswered)
        viewModel.clearForTest()
    }

    @Test
    fun `multi-select answer remains editable until both options are selected`() = runViewModelTest {
        val multiSelectQuestion = testQuestionSet().first().copy(
            correctAnswerId = "",
            correctAnswerIds = listOf("opt_b", "opt_c")
        )
        testContentRepository.oirQuestionsResult = Result.success(
            testQuestionSet().mapIndexed { index, question ->
                if (index == 0) multiSelectQuestion else question
            }
        )

        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.selectOption("opt_b")
        assertEquals(setOf("opt_b"), viewModel.uiState.value.selectedOptionIds)
        assertEquals(false, viewModel.uiState.value.showFeedback)
        assertEquals(false, viewModel.uiState.value.currentQuestionAnswered)

        viewModel.selectOption("opt_c")
        val state = viewModel.uiState.value
        assertEquals(setOf("opt_b", "opt_c"), state.selectedOptionIds)
        assertTrue(state.showFeedback)
        assertTrue(state.isCurrentAnswerCorrect)
        assertTrue(state.currentQuestionAnswered)
        assertTrue(state.session?.answers?.get(multiSelectQuestion.id)?.isCorrect == true)
        viewModel.clearForTest()
    }

    @Test
    fun `nextQuestion advances index and resets feedback for unanswered question`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.selectOption("opt_a")
        viewModel.nextQuestion()

        val state = viewModel.uiState.value
        assertEquals(1, state.currentQuestionIndex)
        assertEquals(false, state.currentQuestionAnswered)
        viewModel.clearForTest()
    }

    @Test
    fun `previousQuestion restores prior answer state`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()
        viewModel.selectOption("opt_a")
        viewModel.nextQuestion()

        viewModel.previousQuestion()

        val state = viewModel.uiState.value
        assertEquals(0, state.currentQuestionIndex)
        assertTrue(state.currentQuestionAnswered)
        assertEquals(setOf("opt_a"), state.selectedOptionIds)
        viewModel.clearForTest()
    }

    @Test
    fun `submitTest completes session and carries subscription type`() = runViewModelTest {
        subscriptionRepository.tierResult = Result.success(SubscriptionTier.FREE)
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isCompleted)
        assertNotNull(state.submissionId)
        assertEquals(SubscriptionTier.FREE, state.subscriptionType)
        assertNotNull(state.testResult)
        assertEquals(false, state.isTimerActive)
        viewModel.clearForTest()
    }

    @Test
    fun `submitTest failure surfaces SUBMIT_FAILED without completing`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(OIRErrorType.SUBMIT_FAILED, state.errorType)
        assertEquals(false, state.isCompleted)
        viewModel.clearForTest()
    }

    @Test
    fun `pauseTest stops the timer and abandons the session`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.pauseTest()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(false, viewModel.uiState.value.isTimerActive)
        assertTrue(testSessionRepository.endedSessionIds.isNotEmpty())
        viewModel.clearForTest()
    }

    @Test
    fun `unanswered question is recorded as skipped when advancing`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.nextQuestion()

        val session = viewModel.uiState.value.session
        assertTrue(session?.answers?.get("q1")?.skipped == true)
        assertEquals(1, viewModel.uiState.value.currentQuestionIndex)
        viewModel.clearForTest()
    }

    @Test
    fun `submit request shows confirmation without starting submission`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.requestSubmit()

        assertTrue(viewModel.uiState.value.showSubmitConfirmation)
        assertEquals(false, viewModel.uiState.value.isSubmitting)
        viewModel.clearForTest()
    }

    @Test
    fun `submit marks unanswered questions skipped before scoring`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val result = viewModel.uiState.value.testResult
        assertEquals(50, result?.skippedQuestions)
        viewModel.clearForTest()
    }

    @Test
    fun `timer counts down one second at a time`() = runViewModelTest {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.runCurrent()
        val initialRemaining = viewModel.uiState.value.timeRemainingSeconds

        testDispatcher.scheduler.advanceTimeBy(1_000)
        testDispatcher.scheduler.runCurrent()

        assertTrue(viewModel.uiState.value.timeRemainingSeconds <= initialRemaining)
        assertTrue(viewModel.uiState.value.isTimerActive)
        viewModel.clearForTest()
    }
}
