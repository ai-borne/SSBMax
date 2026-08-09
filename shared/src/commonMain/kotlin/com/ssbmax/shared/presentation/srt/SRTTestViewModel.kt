package com.ssbmax.shared.presentation.srt

import com.ssbmax.shared.domain.model.SRTPhase
import com.ssbmax.shared.domain.model.SRTSituationResponse
import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.SRTTestConfig
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.submission.SubmitSRTTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.ObservabilitySeam
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.common.runCountdownLoop
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
 * KMP port of `app/.../ui/tests/srt/SRTTestViewModel.kt`. A real
 * `androidx.lifecycle.ViewModel` using `viewModelScope`, same shape as
 * [com.ssbmax.shared.presentation.wat.WATTestViewModel] (see that file for
 * the fuller writeup of shared deviations: `WorkManager` -> [SubmissionAnalysisTrigger];
 * `SubscriptionManager` -> [CheckTestEligibilityUseCase]; other Android-only
 * managers/loggers dropped; `System.currentTimeMillis()` -> `kotlinx.datetime.Clock.System`).
 *
 * Real finding for this session: SRT, like WAT/TAT/PPDT, genuinely enqueues a
 * real background analysis job (`enqueueSRTAnalysisWorker` -> `WorkManager` +
 * `SRTAnalysisWorker`), so [SubmissionAnalysisTrigger] applies unchanged --
 * not a rule-based/synchronous scorer.
 *
 * Structurally a hybrid of TAT/WAT, confirmed by reading the real Android
 * state machine: like WAT, no separate "viewing" sub-phase; unlike WAT, (a) a
 * single whole-test 30-minute countdown (not per-item), and (b) a genuine
 * REVIEW phase after the last situation where any response can be edited
 * (`editResponse(index)` jumps back to IN_PROGRESS) before a final explicit
 * submit. `isTimeUp` reproduces the Android original's non-dismissible
 * "Time's Up" dialog (2s grace period, then auto-submit) -- real product
 * behavior, not incidental.
 *
 * Builds its own [SRTSubmission] and calls
 * [GetSubscriptionTierUseCase]/[TestUsageRecorder] directly, same precedent as
 * WAT -- [SubmitSRTTestUseCase] stays the thin pass-through it already was.
 */
class SRTTestViewModel(
    private val testContentRepository: TestContentRepository,
    private val testSessionRepository: TestSessionRepository,
    private val submitSRTTest: SubmitSRTTestUseCase,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val checkTestEligibility: CheckTestEligibilityUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val usageRecorder: TestUsageRecorder,
    private val analysisTrigger: SubmissionAnalysisTrigger,
    private val observability: ObservabilitySeam
) : ViewModel() {
    private val tag = "SRTTestViewModel"

    private val _uiState = MutableStateFlow(SRTTestUiState())
    val uiState: StateFlow<SRTTestUiState> = _uiState.asStateFlow()

    private var timerGeneration = 0L
    private var timerJob: Job? = null
    private var capturedUserId: String? = null
    private var capturedSessionId: String? = null

    fun loadTest(testId: String = "srt_standard") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadingMessage = "Checking eligibility...", error = null) }

            val userId = observeCurrentUser().first()?.id ?: run {
                observability.logger.e(tag, "SECURITY: Unauthenticated SRT test access blocked", null)
                observability.analyticsTracker.trackEvent(SecurityEvents.UNAUTHENTICATED_ACCESS, mapOf("test_type" to "SRT"))
                _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.AUTH_REQUIRED) }
                return@launch
            }
            capturedUserId = userId

            when (val eligibility = checkTestEligibility(TestType.SRT, userId)) {
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

            testSessionRepository.createTestSession(userId, testId, TestType.SRT)
                .onSuccess { sessionId -> capturedSessionId = sessionId }
                .onFailure { e ->
                    observability.logger.e(tag, "Failed to create SRT test session: $testId", e)
                    _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.CLOUD_REQUIRED) }
                    return@launch
                }

            testContentRepository.getSRTQuestions(testId)
                .onSuccess { situations ->
                    if (situations.isEmpty()) {
                        observability.logger.e(tag, "No SRT situations found for test: $testId", null)
                        releaseSessionAfterFailedLoad()
                        _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.LOAD_FAILED) }
                        return@onSuccess
                    }
                    _uiState.update {
                        it.copy(
                            isLoading = false, loadingMessage = null,
                            testId = testId, situations = situations, config = SRTTestConfig(),
                            phase = SRTPhase.INSTRUCTIONS
                        )
                    }
                }
                .onFailure { e ->
                    if (e is CancellationException) throw e
                    observability.logger.e(tag, "Failed to load SRT test: $testId", e)
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
            it.copy(phase = SRTPhase.IN_PROGRESS, currentSituationIndex = 0, startTime = Clock.System.now().toEpochMilliseconds())
        }
        startTimer()
    }

    private fun startTimer() {
        timerJob?.cancel()
        val myGeneration = ++timerGeneration
        val totalTimeSeconds = (_uiState.value.config?.totalTimeMinutes ?: 30) * 60
        _uiState.update { it.copy(timeRemaining = totalTimeSeconds, isTimerActive = true, timerStartTime = myGeneration) }
        val endTime = Clock.System.now().toEpochMilliseconds() + (totalTimeSeconds * 1000L)

        timerJob = viewModelScope.launch {
            try {
                runCountdownLoop(endTime, tickMillis = 500L) { remaining -> _uiState.update { it.copy(timeRemaining = remaining) } }
                if (isActive) {
                    _uiState.update { it.copy(isTimeUp = true) }
                    delay(2000) // grace period -- let the "Time's Up" dialog be seen
                    if (isActive) submitTest()
                }
            } finally {
                _uiState.update { c -> if (c.timerStartTime == myGeneration) c.copy(isTimerActive = false) else c }
            }
        }
    }

    fun updateResponse(response: String) {
        val maxLength = _uiState.value.config?.maxResponseLength ?: 200
        if (response.length <= maxLength) {
            _uiState.update { it.copy(currentResponse = response) }
        }
    }

    fun moveToNext() = recordAndAdvance(skipped = false)

    fun skipSituation() = recordAndAdvance(skipped = true)

    /** Shared tail of `moveToNext()`/`skipSituation()`: record a response for the
     *  current situation (as typed, or blank+skipped), then advance to the next
     *  situation or -- on the last one -- into [SRTPhase.REVIEW]. */
    private fun recordAndAdvance(skipped: Boolean) {
        val state = _uiState.value
        val currentSituation = state.currentSituation ?: return

        val response = SRTSituationResponse(
            situationId = currentSituation.id,
            situation = currentSituation.situation,
            response = if (skipped) "" else state.currentResponse,
            charactersCount = if (skipped) 0 else state.currentResponse.length,
            timeTakenSeconds = if (skipped) 0 else 30,
            submittedAt = Clock.System.now().toEpochMilliseconds(),
            isSkipped = skipped
        )
        replaceResponse(response)

        if (state.currentSituationIndex < state.situations.size - 1) {
            _uiState.update { it.copy(currentSituationIndex = state.currentSituationIndex + 1, currentResponse = "") }
        } else {
            _uiState.update { it.copy(phase = SRTPhase.REVIEW, currentResponse = "") }
        }
    }

    private fun replaceResponse(response: SRTSituationResponse) {
        _uiState.update { state ->
            state.copy(responses = state.responses.filterNot { it.situationId == response.situationId } + response)
        }
    }

    fun editResponse(index: Int) {
        val state = _uiState.value
        if (index in state.situations.indices) {
            val responseToEdit = state.responses.getOrNull(index)
            _uiState.update {
                it.copy(currentSituationIndex = index, currentResponse = responseToEdit?.response ?: "", phase = SRTPhase.IN_PROGRESS)
            }
        }
    }

    fun submitTest() {
        _uiState.update { it.copy(isLoading = true) }
        val state = _uiState.value
        viewModelScope.launch {
            val userId = capturedUserId ?: observeCurrentUser().first()?.id
            if (userId == null) {
                observability.logger.e(tag, "Unauthenticated SRT submission blocked", null)
                observability.analyticsTracker.trackEvent(
                    SecurityEvents.UNAUTHENTICATED_ACCESS,
                    mapOf("test_type" to "SRT", "phase" to "submission")
                )
                _uiState.update { it.copy(isLoading = false, error = TestError.LOGIN_TO_SUBMIT) }
                return@launch
            }

            val subscriptionType = getSubscriptionTier(userId).getOrDefault(SubscriptionTier.FREE)

            // Flush a partial (mid-typing) response for the currently-open situation,
            // same as the Android original -- only relevant if submit is reached from
            // IN_PROGRESS (time-up auto-submit) rather than via REVIEW.
            val currentSituation = state.currentSituation
            val finalResponses = if (state.currentResponse.isNotEmpty() && currentSituation != null) {
                val partial = SRTSituationResponse(
                    situationId = currentSituation.id,
                    situation = currentSituation.situation,
                    response = state.currentResponse,
                    charactersCount = state.currentResponse.length,
                    timeTakenSeconds = 30,
                    submittedAt = Clock.System.now().toEpochMilliseconds(),
                    isSkipped = false
                )
                state.responses.filterNot { it.situationId == partial.situationId } + partial
            } else {
                state.responses
            }

            val totalTimeTakenMinutes = if (state.startTime > 0) {
                ((Clock.System.now().toEpochMilliseconds() - state.startTime) / 60000).toInt()
            } else 0

            val submission = SRTSubmission(
                userId = userId,
                testId = state.testId,
                responses = finalResponses,
                totalTimeTakenMinutes = totalTimeTakenMinutes,
                submittedAt = Clock.System.now().toEpochMilliseconds(),
                analysisStatus = AnalysisStatus.PENDING_ANALYSIS,
                olqResult = null
            )

            submitSRTTest(submission, batchId = null)
                .onSuccess { submissionId ->
                    analysisTrigger.trigger(TestType.SRT, submissionId)
                    usageRecorder.recordTestUsage(TestType.SRT, userId, submissionId)
                    capturedSessionId?.let { testSessionRepository.completeTestSession(it) }
                    _uiState.update {
                        it.copy(
                            isLoading = false, isSubmitted = true, submissionId = submissionId,
                            subscriptionType = subscriptionType, submission = submission,
                            phase = SRTPhase.SUBMITTED
                        )
                    }
                }
                .onFailure { error ->
                    if (error is CancellationException) throw error
                    observability.logger.e(tag, "Failed to submit SRT test for user: $userId", error)
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
