package com.ssbmax.shared.presentation.tat

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TATPhase
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TATTestConfig
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitTATTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.usecase.tat.LoadTATTestUseCase
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.common.runCountdownLoop
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.time.Clock

/**
 * KMP port of `app/.../ui/tests/tat/TATTestViewModel.kt`.
 *
 * A real `androidx.lifecycle.ViewModel` using `viewModelScope`, same shape as
 * [com.ssbmax.shared.presentation.ppdt.PPDTTestViewModel] (see that file for
 * the fuller writeup of shared deviations: `WorkManager` -> here,
 * `TATAnalysisPipelineOrchestrator`'s bounded-batch graph, replaced by
 * [SubmissionAnalysisTrigger] -- which IS backed by a real trigger on both
 * platforms now (correcting this comment's stale claim that submissions
 * persist un-analyzed): `WorkManagerSubmissionAnalysisTrigger` on Android,
 * [com.ssbmax.shared.analysis.KtorSubmissionAnalysisTrigger] ->
 * [com.ssbmax.shared.analysis.TATAnalysisOrchestrator] on iOS;
 * `SubscriptionManager` ->
 * [CheckTestEligibilityUseCase]; `DifficultyProgressionManager`/
 * `MemoryLeakTracker` dropped, no KMP port needed; `System.currentTimeMillis()`
 * -> `kotlinx.datetime.Clock.System`).
 *
 * Unlike PPDT (which delegates submission-building to
 * `SubmitPPDTTestUseCase`), this ViewModel builds the [TATSubmission] itself
 * and calls [GetSubscriptionTierUseCase]/[TestUsageRecorder] directly, mirroring
 * the Android original's `submitTest()`. [SubmitTATTestUseCase] stayed a thin
 * pass-through (not widened like PPDT's) because
 * `app/.../ui/tests/tat/TATTestViewModel.kt` -- the live, untouched Android
 * flow -- already calls its exact `invoke(submission, batchId)` signature;
 * see that use case's own doc comment.
 *
 * The generation-token timer pattern (`docs/architecture/TAT_Pipeline.md`
 * §5) is preserved verbatim: both timer functions share one coroutine slot,
 * each stamping a fresh `timerGeneration` into `timerStartTime` so a stale
 * timer's `finally` block can't clobber `isTimerActive` after a newer timer
 * already took over.
 */
class TATTestViewModel(
    private val loadTATTest: LoadTATTestUseCase,
    private val submitTATTest: SubmitTATTestUseCase,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val checkTestEligibility: CheckTestEligibilityUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val usageRecorder: TestUsageRecorder,
    private val analysisTrigger: SubmissionAnalysisTrigger,
    private val testSessionRepository: TestSessionRepository,
    private val logger: DomainLogger,
    private val analyticsTracker: AnalyticsTracker
) : ViewModel() {
    private val tag = "TATTestViewModel"

    private val _uiState = MutableStateFlow(TATTestUiState())
    val uiState: StateFlow<TATTestUiState> = _uiState.asStateFlow()

    private var timerGeneration = 0L
    private var timerJob: Job? = null
    private var capturedUserId: String? = null
    private var capturedSessionId: String? = null

    fun loadTest(testId: String = "tat_standard") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadingMessage = "Checking eligibility...", error = null) }

            val userId = observeCurrentUser().first()?.id ?: run {
                logger.e(tag, "SECURITY: Unauthenticated TAT test access blocked", null)
                analyticsTracker.trackEvent(SecurityEvents.UNAUTHENTICATED_ACCESS, mapOf("test_type" to "TAT"))
                _uiState.update {
                    it.copy(isLoading = false, loadingMessage = null, error = TestError.AUTH_REQUIRED)
                }
                return@launch
            }
            capturedUserId = userId

            when (val eligibility = checkTestEligibility(TestType.TAT, userId)) {
                is TestEligibility.LimitReached -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false, loadingMessage = null, error = null,
                            isLimitReached = true, subscriptionTier = eligibility.tier,
                            testsLimit = eligibility.limit, testsUsed = eligibility.usedCount,
                            resetsAt = eligibility.resetsAt
                        )
                    }
                    return@launch
                }
                is TestEligibility.NetworkError -> {
                    _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.NETWORK_UNAVAILABLE) }
                    return@launch
                }
                is TestEligibility.Eligible -> Unit
            }

            _uiState.update { it.copy(loadingMessage = "Fetching questions from cloud...") }

            loadTATTest(userId, testId)
                .onSuccess { result ->
                    if (result.questions.isEmpty()) {
                        logger.e(tag, "No TAT questions found for test: $testId", null)
                        _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.LOAD_FAILED) }
                        return@onSuccess
                    }
                    capturedSessionId = result.sessionId
                    _uiState.update {
                        it.copy(
                            isLoading = false, loadingMessage = null,
                            testId = testId, questions = result.questions, config = TATTestConfig(),
                            phase = TATPhase.INSTRUCTIONS, startTime = Clock.System.now().toEpochMilliseconds()
                        )
                    }
                }
                .onFailure { e ->
                    when (e) {
                        is LoadTATTestUseCase.ProfileIncompleteException ->
                            _uiState.update { it.copy(isLoading = false, loadingMessage = null, isProfileIncomplete = true) }
                        is CancellationException -> throw e
                        else -> {
                            logger.e(tag, "Failed to load TAT test: $testId", e)
                            _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.CLOUD_REQUIRED) }
                        }
                    }
                }
        }
    }

    fun startTest() {
        _uiState.update { it.copy(phase = TATPhase.IMAGE_VIEWING, currentQuestionIndex = 0) }
        startViewingTimer()
    }

    fun updateStory(story: String) {
        _uiState.update { it.copy(currentStory = story) }
    }

    private fun saveCurrentStoryToResponses() {
        val state = _uiState.value
        val currentQuestion = state.currentQuestion ?: return
        if (state.currentStory.isBlank()) return
        val response = TATStoryResponse(
            questionId = currentQuestion.id,
            story = state.currentStory,
            charactersCount = state.currentStory.length,
            viewingTimeTakenSeconds = 30 - state.viewingTimeRemaining,
            writingTimeTakenSeconds = (4 * 60) - state.writingTimeRemaining,
            submittedAt = Clock.System.now().toEpochMilliseconds()
        )
        val updatedResponses = state.responses.toMutableList().apply {
            removeAll { it.questionId == response.questionId }
            add(response)
        }
        _uiState.update { it.copy(responses = updatedResponses) }
    }

    fun moveToNextQuestion() {
        saveCurrentStoryToResponses()
        val state = _uiState.value
        if (state.currentQuestionIndex < state.questions.size - 1) {
            _uiState.update {
                it.copy(currentQuestionIndex = state.currentQuestionIndex + 1, currentStory = "", phase = TATPhase.IMAGE_VIEWING)
            }
            startViewingTimer()
        } else {
            _uiState.update { it.copy(isTimerActive = false, phase = TATPhase.REVIEW) }
        }
    }

    fun editCurrentStory() {
        _uiState.update { it.copy(phase = TATPhase.WRITING) }
        startWritingTimer()
    }

    fun confirmCurrentStory() {
        moveToNextQuestion()
    }

    fun submitTest() {
        saveCurrentStoryToResponses()
        _uiState.update { it.copy(isLoading = true, isTimerActive = false) }
        val state = _uiState.value
        viewModelScope.launch {
            val userId = capturedUserId ?: observeCurrentUser().first()?.id
            if (userId == null) {
                logger.e(tag, "Unauthenticated TAT submission blocked", null)
                analyticsTracker.trackEvent(
                    SecurityEvents.UNAUTHENTICATED_ACCESS,
                    mapOf("test_type" to "TAT", "phase" to "submission")
                )
                _uiState.update { it.copy(isLoading = false, error = TestError.LOGIN_TO_SUBMIT) }
                return@launch
            }

            val subscriptionType = getSubscriptionTier(userId).getOrDefault(SubscriptionTier.FREE)

            val totalTimeTakenMinutes = if (state.startTime > 0) {
                ((Clock.System.now().toEpochMilliseconds() - state.startTime) / 60000).toInt()
            } else 0

            val submission = TATSubmission(
                userId = userId,
                testId = state.testId,
                stories = state.responses,
                totalTimeTakenMinutes = totalTimeTakenMinutes,
                submittedAt = Clock.System.now().toEpochMilliseconds(),
                analysisStatus = AnalysisStatus.PENDING_ANALYSIS,
                olqResult = null
            )

            submitTATTest(submission, batchId = null)
                .onSuccess { submissionId ->
                    analysisTrigger.trigger(TestType.TAT, submissionId)
                    usageRecorder.recordTestUsage(TestType.TAT, userId, submissionId)
                    capturedSessionId?.let { testSessionRepository.completeTestSession(it) }
                    _uiState.update {
                        it.copy(
                            isLoading = false, isSubmitted = true, submissionId = submissionId,
                            subscriptionType = subscriptionType, submission = submission,
                            phase = TATPhase.SUBMITTED
                        )
                    }
                }
                .onFailure { error ->
                    if (error is CancellationException) throw error
                    logger.e(tag, "Failed to submit TAT test for user: $userId", error)
                    _uiState.update { it.copy(isLoading = false, error = TestError.SUBMIT_FAILED) }
                }
        }
    }

    // Exiting a test must abandon the durable session (mirrors PPDT/OIR's pauseTest()) so a
    // retake isn't blocked by a stuck-ACTIVE test_sessions doc for up to its 2-hour expiresAt.
    fun pauseTest() {
        val sessionId = capturedSessionId ?: return
        _uiState.update { it.copy(isTimerActive = false) }
        timerJob?.cancel()
        viewModelScope.launch {
            testSessionRepository.abandonTestSession(sessionId)
        }
    }

    private fun startViewingTimer() {
        timerJob?.cancel()
        val myGeneration = ++timerGeneration
        val viewingTime = _uiState.value.config?.viewingTimePerPictureSeconds ?: 30
        _uiState.update { it.copy(viewingTimeRemaining = viewingTime, isTimerActive = true, timerStartTime = myGeneration) }
        val endTime = Clock.System.now().toEpochMilliseconds() + (viewingTime * 1000L)
        timerJob = viewModelScope.launch {
            try {
                runCountdownLoop(endTime) { remaining -> _uiState.update { it.copy(viewingTimeRemaining = remaining) } }
                if (isActive) {
                    _uiState.update { it.copy(phase = TATPhase.WRITING) }
                    startWritingTimer()
                }
            } finally {
                _uiState.update { c -> if (c.timerStartTime == myGeneration) c.copy(isTimerActive = false) else c }
            }
        }
    }

    private fun startWritingTimer() {
        timerJob?.cancel()
        val myGeneration = ++timerGeneration
        val writingTimeSeconds = (_uiState.value.config?.writingTimePerPictureMinutes ?: 4) * 60
        _uiState.update { it.copy(writingTimeRemaining = writingTimeSeconds, isTimerActive = true, timerStartTime = myGeneration) }
        val endTime = Clock.System.now().toEpochMilliseconds() + (writingTimeSeconds * 1000L)
        timerJob = viewModelScope.launch {
            try {
                runCountdownLoop(endTime) { remaining -> _uiState.update { it.copy(writingTimeRemaining = remaining) } }
                if (isActive) {
                    saveCurrentStoryToResponses()
                    _uiState.update { it.copy(phase = TATPhase.REVIEW) }
                }
            } finally {
                _uiState.update { c -> if (c.timerStartTime == myGeneration) c.copy(isTimerActive = false) else c }
            }
        }
    }

    override fun onCleared() {
        timerJob?.cancel()
    }
}
