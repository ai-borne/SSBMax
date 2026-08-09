package com.ssbmax.shared.presentation.sdt

import com.ssbmax.shared.domain.model.SDTPhase
import com.ssbmax.shared.domain.model.SDTQuestionResponse
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.SDTTestConfig
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitSDTTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.ObservabilitySeam
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.presentation.common.TestError
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.time.Clock

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestViewModel.kt`. A real
 * `androidx.lifecycle.ViewModel` using `viewModelScope`, same shape as
 * [com.ssbmax.shared.presentation.srt.SRTTestViewModel] (see that file for
 * the fuller writeup of shared deviations: `WorkManager` -> [SubmissionAnalysisTrigger];
 * `SubscriptionManager` -> [CheckTestEligibilityUseCase]; other Android-only
 * managers/loggers dropped; `System.currentTimeMillis()` -> `kotlinx.datetime.Clock.System`).
 *
 * Real finding for this session: SDT, like TAT/WAT/PPDT/SRT, genuinely
 * enqueues a real background analysis job (`enqueueSDTAnalysisWorker` ->
 * `WorkManager` + `SDTAnalysisWorker`), so [SubmissionAnalysisTrigger]
 * applies unchanged -- not a rule-based/synchronous scorer.
 *
 * Structurally distinct from TAT/WAT/SRT, confirmed by reading the real
 * Android state machine: only 4 fixed essay-style questions (not 60
 * situations / dozens of words / a dozen picture stories), a single
 * whole-test 15-minute countdown, and -- like SRT -- a genuine REVIEW phase
 * after the last question where any response can be edited
 * (`editQuestion(index)` jumps back to IN_PROGRESS) before a final explicit
 * submit.
 *
 * Builds its own [SDTSubmission] and calls
 * [GetSubscriptionTierUseCase]/[TestUsageRecorder] directly, same precedent as
 * SRT/WAT -- [SubmitSDTTestUseCase] stays the thin pass-through it already
 * was. Android original's `DifficultyProgressionManager.recordPerformance`
 * call is dropped here, same precedent as other ported verticals (it's a
 * local analytics side-effect, not part of the submission contract).
 */
class SDTTestViewModel(
    private val testContentRepository: TestContentRepository,
    private val testSessionRepository: TestSessionRepository,
    private val submitSDTTest: SubmitSDTTestUseCase,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val checkTestEligibility: CheckTestEligibilityUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val usageRecorder: TestUsageRecorder,
    private val analysisTrigger: SubmissionAnalysisTrigger,
    private val observability: ObservabilitySeam
) : ViewModel() {
    private val tag = "SDTTestViewModel"

    private val _uiState = MutableStateFlow(SDTTestUiState())
    val uiState: StateFlow<SDTTestUiState> = _uiState.asStateFlow()

    private var timerGeneration = 0L
    private var timerJob: Job? = null
    private var capturedUserId: String? = null
    private var capturedSessionId: String? = null

    fun loadTest(testId: String = "sdt_standard") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadingMessage = "Checking eligibility...", error = null) }

            val userId = observeCurrentUser().first()?.id ?: run {
                observability.logger.e(tag, "SECURITY: Unauthenticated SDT test access blocked", null)
                observability.analyticsTracker.trackEvent(SecurityEvents.UNAUTHENTICATED_ACCESS, mapOf("test_type" to "SDT"))
                _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.AUTH_REQUIRED) }
                return@launch
            }
            capturedUserId = userId

            when (val eligibility = checkTestEligibility(TestType.SD, userId)) {
                is TestEligibility.LimitReached -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false, loadingMessage = null, error = null,
                            isLimitReached = true, subscriptionTier = eligibility.tier,
                            testsLimit = eligibility.limit, testsUsed = eligibility.usedCount, resetsAt = eligibility.resetsAt
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

            testSessionRepository.createTestSession(userId, testId, TestType.SD)
                .onSuccess { sessionId -> capturedSessionId = sessionId }
                .onFailure { e ->
                    observability.logger.e(tag, "Failed to create SDT test session: $testId", e)
                    _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.CLOUD_REQUIRED) }
                    return@launch
                }

            testContentRepository.getSDTQuestions(testId)
                .onSuccess { questions ->
                    if (questions.isEmpty()) {
                        observability.logger.e(tag, "No SDT questions found for test: $testId", null)
                        releaseSessionAfterFailedLoad()
                        _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.LOAD_FAILED) }
                        return@onSuccess
                    }
                    _uiState.update {
                        it.copy(
                            isLoading = false, loadingMessage = null,
                            testId = testId, questions = questions, config = SDTTestConfig(),
                            phase = SDTPhase.INSTRUCTIONS
                        )
                    }
                }
                .onFailure { e ->
                    if (e is CancellationException) throw e
                    observability.logger.e(tag, "Failed to load SDT test: $testId", e)
                    releaseSessionAfterFailedLoad()
                    _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.CLOUD_REQUIRED) }
                }
        }
    }

    /**
     * Releases the session created moments ago when the *rest* of the load then failed. Without
     * this the `test_sessions` doc is left ACTIVE for a test the candidate never entered, which
     * both corrupts the audit trail and makes [hasActiveTestSession] lie. Mirrors the equivalent
     * cleanup in `OIRTestViewModel.loadTest`.
     */
    private suspend fun releaseSessionAfterFailedLoad() {
        capturedSessionId?.let { testSessionRepository.abandonTestSession(it) }
        capturedSessionId = null
    }

    fun startTest() {
        _uiState.update {
            it.copy(phase = SDTPhase.IN_PROGRESS, currentQuestionIndex = 0, startTime = Clock.System.now().toEpochMilliseconds())
        }
        startTimer()
    }

    private fun startTimer() {
        timerJob?.cancel()
        val myGeneration = ++timerGeneration
        val totalTimeSeconds = (_uiState.value.config?.totalTimeSeconds ?: 900)
        _uiState.update { it.copy(totalTimeRemaining = totalTimeSeconds, isTimerActive = true, timerStartTime = myGeneration) }
        val endTime = Clock.System.now().toEpochMilliseconds() + (totalTimeSeconds * 1000L)

        timerJob = viewModelScope.launch {
            try {
                while (isActive) {
                    val remaining = ((endTime - Clock.System.now().toEpochMilliseconds()) / 1000).toInt()
                    if (remaining <= 0) break
                    _uiState.update { it.copy(totalTimeRemaining = remaining) }
                    delay(200)
                }
                if (isActive) {
                    _uiState.update { it.copy(phase = SDTPhase.REVIEW) }
                }
            } finally {
                _uiState.update { c -> if (c.timerStartTime == myGeneration) c.copy(isTimerActive = false) else c }
            }
        }
    }

    fun updateAnswer(answer: String) {
        val maxChars = _uiState.value.config?.maxCharsPerQuestion ?: 1500
        if (answer.trim().length <= maxChars) {
            _uiState.update { it.copy(currentAnswer = answer) }
        }
    }

    fun moveToNext() = recordAndAdvance(skipped = false)

    fun skipQuestion() = recordAndAdvance(skipped = true)

    /** Shared tail of `moveToNext()`/`skipQuestion()`: record a response for the
     *  current question (as typed, or blank+skipped), then advance to the next
     *  question or -- on the last one -- into [SDTPhase.REVIEW]. */
    private fun recordAndAdvance(skipped: Boolean) {
        val state = _uiState.value
        val currentQuestion = state.currentQuestion ?: return

        val response = SDTQuestionResponse(
            questionId = currentQuestion.id,
            question = currentQuestion.question,
            answer = if (skipped) "" else state.currentAnswer,
            charCount = if (skipped) 0 else state.currentCharCount,
            timeTakenSeconds = ((state.config?.totalTimeSeconds ?: 900) - state.totalTimeRemaining),
            submittedAt = Clock.System.now().toEpochMilliseconds(),
            isSkipped = skipped
        )
        replaceResponse(response)

        if (state.currentQuestionIndex < state.questions.size - 1) {
            _uiState.update { it.copy(currentQuestionIndex = state.currentQuestionIndex + 1, currentAnswer = "") }
        } else {
            _uiState.update { it.copy(isTimerActive = false, phase = SDTPhase.REVIEW, currentAnswer = "") }
        }
    }

    private fun replaceResponse(response: SDTQuestionResponse) {
        _uiState.update { state ->
            state.copy(responses = state.responses.filterNot { it.questionId == response.questionId } + response)
        }
    }

    fun editQuestion(index: Int) {
        val state = _uiState.value
        if (index in state.questions.indices) {
            val responseToEdit = state.responses.getOrNull(index)
            _uiState.update {
                it.copy(currentQuestionIndex = index, currentAnswer = responseToEdit?.answer ?: "", phase = SDTPhase.IN_PROGRESS)
            }
        }
    }

    fun submitTest() {
        _uiState.update { it.copy(isLoading = true) }
        val state = _uiState.value
        viewModelScope.launch {
            val userId = capturedUserId ?: observeCurrentUser().first()?.id
            if (userId == null) {
                observability.logger.e(tag, "Unauthenticated SDT submission blocked", null)
                observability.analyticsTracker.trackEvent(
                    SecurityEvents.UNAUTHENTICATED_ACCESS,
                    mapOf("test_type" to "SDT", "phase" to "submission")
                )
                _uiState.update { it.copy(isLoading = false, error = TestError.LOGIN_TO_SUBMIT) }
                return@launch
            }

            _uiState.update { it.copy(isTimerActive = false) }

            val subscriptionType = getSubscriptionTier(userId).getOrDefault(SubscriptionTier.FREE)

            val totalTimeTakenMinutes = if (state.startTime > 0) {
                ((Clock.System.now().toEpochMilliseconds() - state.startTime) / 60000).toInt()
            } else 0

            val submission = SDTSubmission(
                userId = userId,
                testId = state.testId,
                responses = state.responses,
                totalTimeTakenMinutes = totalTimeTakenMinutes,
                submittedAt = Clock.System.now().toEpochMilliseconds(),
                analysisStatus = AnalysisStatus.PENDING_ANALYSIS,
                olqResult = null
            )

            submitSDTTest(submission, batchId = null)
                .onSuccess { submissionId ->
                    analysisTrigger.trigger(TestType.SD, submissionId)
                    usageRecorder.recordTestUsage(TestType.SD, userId, submissionId)
                    capturedSessionId?.let { testSessionRepository.completeTestSession(it) }
                    _uiState.update {
                        it.copy(
                            isLoading = false, isSubmitted = true, submissionId = submissionId,
                            subscriptionType = subscriptionType, submission = submission,
                            phase = SDTPhase.SUBMITTED
                        )
                    }
                }
                .onFailure { error ->
                    if (error is CancellationException) throw error
                    observability.logger.e(tag, "Failed to submit SDT test for user: $userId", error)
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

    override fun onCleared() {
        timerJob?.cancel()
    }
}
