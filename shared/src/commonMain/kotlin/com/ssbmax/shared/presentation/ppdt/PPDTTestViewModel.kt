package com.ssbmax.shared.presentation.ppdt

import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.domain.model.TestEligibility
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.DifficultyProgressionRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.ppdt.LoadPPDTTestUseCase
import com.ssbmax.shared.domain.usecase.ppdt.SubmitPPDTTestUseCase
import com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.util.SecurityEvents
import com.ssbmax.shared.presentation.common.TestError
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
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
 * KMP port of `app/.../ui/tests/ppdt/PPDTTestViewModel.kt`.
 *
 * A real `androidx.lifecycle.ViewModel` using `viewModelScope`
 * ([com.ssbmax.shared.presentation.oir.OIRTestViewModel] is the closest
 * sibling — same shape: load -> phase state machine -> submit -> timer).
 * Screen uses `koinViewModel()`; `viewModelScope` is cancelled automatically
 * in [onCleared], no manual `DisposableEffect`/`close()` needed.
 *
 * Deviations from the Android original, all deliberate and documented:
 * - `androidx.work.WorkManager` (`BaseTestViewModel.enqueueAnalysisWork`,
 *   called via `enqueuePPDTAnalysisWorker`) is replaced by
 *   [SubmissionAnalysisTrigger] — see that interface's own doc comment for
 *   the full explanation of why (the concrete `PPDTAnalysisWorker` class
 *   lives in `app`, which `shared` cannot depend on) and exactly what this
 *   means for a submission made through this ViewModel today (it will NOT
 *   be analyzed until a real platform trigger is wired in from `app`).
 * - `SubscriptionManager`/`TestEligibility` (Android `core:data`) replaced by
 *   [CheckTestEligibilityUseCase] — same substitution and same caveats
 *   (debug bypass, Room usage mirror still dropped) as already documented
 *   on that use case. `SecurityEventLogger`'s unauthenticated-access event
 *   is restored (Phase 7a) via the injected [AnalyticsTracker], same as
 *   `OIRTestViewModel`.
 * - `DifficultyProgressionManager.recordPerformance()` (Android `core:data`)
 *   is restored via [DifficultyProgressionRepository] (Phase 3c, #17) — backed
 *   by [com.ssbmax.shared.data.repository.GitLiveDifficultyProgressionManager],
 *   a SQLDelight-backed KMP port of the same algorithm.
 * - `MemoryLeakTracker`/`trackMemoryLeaks` (Android-only) dropped, same
 *   reasoning as `OIRTestViewModel`'s doc comment: `viewModelScope` already
 *   makes the leak class it targeted structurally impossible.
 * - `System.currentTimeMillis()` (JVM-only) replaced with
 *   `kotlinx.datetime.Clock.System`, matching every other ported ViewModel.
 */
class PPDTTestViewModel(
    private val loadPPDTTest: LoadPPDTTestUseCase,
    private val submitPPDTTest: SubmitPPDTTestUseCase,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val checkTestEligibility: CheckTestEligibilityUseCase,
    private val analysisTrigger: SubmissionAnalysisTrigger,
    private val difficultyProgression: DifficultyProgressionRepository,
    private val testSessionRepository: TestSessionRepository,
    private val logger: DomainLogger,
    private val analyticsTracker: AnalyticsTracker
) : ViewModel() {
    private val tag = "PPDTTestViewModel"

    private val _uiState = MutableStateFlow(PPDTTestUiState())
    val uiState: StateFlow<PPDTTestUiState> = _uiState.asStateFlow()

    private var timerGeneration = 0L

    fun loadTest(testId: String = "ppdt_standard") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadingMessage = "Checking eligibility...", error = null) }

            val userId = observeCurrentUser().first()?.id ?: run {
                logger.e(tag, "SECURITY: Unauthenticated PPDT test access blocked", null)
                analyticsTracker.trackEvent(SecurityEvents.UNAUTHENTICATED_ACCESS, mapOf("test_type" to "PPDT"))
                _uiState.update {
                    it.copy(isLoading = false, loadingMessage = null, error = TestError.AUTH_REQUIRED)
                }
                return@launch
            }

            when (val eligibility = checkTestEligibility(TestType.PPDT, userId)) {
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

            loadPPDTTest(userId, testId)
                .onSuccess { session ->
                    _uiState.update { it.copy(session = session) }
                    updateUiFromSession()
                }
                .onFailure { e ->
                    when (e) {
                        is LoadPPDTTestUseCase.ProfileIncompleteException ->
                            _uiState.update { it.copy(isLoading = false, loadingMessage = null, isProfileIncomplete = true) }
                        is CancellationException -> throw e
                        else -> {
                            logger.e(tag, "PPDT loadTest failed: ${e.message}", e)
                            _uiState.update { it.copy(isLoading = false, loadingMessage = null, error = TestError.CLOUD_REQUIRED) }
                        }
                    }
                }
        }
    }

    fun startTest() {
        val session = _uiState.value.session ?: return
        _uiState.update {
            it.copy(session = session.copy(
                currentPhase = PPDTPhase.IMAGE_VIEWING,
                imageViewingStartTime = Clock.System.now().toEpochMilliseconds()
            ))
        }
        updateUiFromSession()
        startTimer(session.question.viewingTimeSeconds)
    }

    fun proceedToNextPhase() {
        val session = _uiState.value.session ?: return
        when (session.currentPhase) {
            PPDTPhase.IMAGE_VIEWING -> {
                _uiState.update {
                    it.copy(
                        isTimerActive = false,
                        session = session.copy(
                            currentPhase = PPDTPhase.WRITING,
                            writingStartTime = Clock.System.now().toEpochMilliseconds()
                        )
                    )
                }
                updateUiFromSession()
                startTimer(session.question.writingTimeMinutes * 60)
            }
            PPDTPhase.WRITING -> {
                if (_uiState.value.story.length >= session.question.minCharacters) {
                    _uiState.update { it.copy(isTimerActive = false, session = session.copy(currentPhase = PPDTPhase.REVIEW)) }
                    updateUiFromSession()
                }
            }
            else -> Unit
        }
    }

    fun returnToWriting() {
        val session = _uiState.value.session ?: return
        _uiState.update { it.copy(session = session.copy(currentPhase = PPDTPhase.WRITING)) }
        updateUiFromSession()
        startTimer(session.question.writingTimeMinutes * 60)
    }

    fun updateStory(newStory: String) {
        val session = _uiState.value.session ?: return
        _uiState.update {
            it.copy(
                session = session.copy(story = newStory),
                story = newStory,
                charactersCount = newStory.length,
                canProceedToNextPhase = newStory.length >= session.question.minCharacters
            )
        }
    }

    fun submitTest() {
        _uiState.update { it.copy(isTimerActive = false) }
        val session = _uiState.value.session ?: return
        viewModelScope.launch {
            submitPPDTTest(session)
                .onSuccess { result ->
                    analysisTrigger.trigger(TestType.PPDT, result.submissionId)
                    val isValid = session.story.length >= session.question.minCharacters
                    val difficulty = difficultyProgression.getRecommendedDifficulty("PPDT")
                    difficultyProgression.recordPerformance(
                        testType = "PPDT", difficulty = difficulty,
                        score = if (isValid) 100f else 0f,
                        correctAnswers = if (isValid) 1 else 0, totalQuestions = 1,
                        timeSeconds = (4 * 60).toFloat()
                    )
                    _uiState.update {
                        it.copy(
                            session = session.copy(currentPhase = PPDTPhase.SUBMITTED, isCompleted = true),
                            isSubmitted = true, submissionId = result.submissionId,
                            subscriptionType = result.subscriptionType, submission = result.submission
                        )
                    }
                }
                .onFailure { error ->
                    if (error is CancellationException) throw error
                    logger.e(tag, "Failed to submit PPDT test for user: ${session.userId}", error)
                    _uiState.update { it.copy(error = TestError.SUBMIT_FAILED) }
                }
        }
    }

    fun pauseTest() {
        val session = _uiState.value.session ?: return
        _uiState.update { it.copy(isTimerActive = false, session = session.copy(isPaused = true)) }
        viewModelScope.launch {
            testSessionRepository.abandonTestSession(session.sessionId)
        }
    }

    private fun startTimer(seconds: Int) {
        val myGeneration = ++timerGeneration
        _uiState.update { it.copy(timeRemainingSeconds = seconds, isTimerActive = true, timerStartTime = myGeneration) }
        viewModelScope.launch {
            try {
                while (isActive && _uiState.value.isTimerActive && _uiState.value.timeRemainingSeconds > 0) {
                    delay(1000)
                    if (!isActive || !_uiState.value.isTimerActive) return@launch
                    val newTime = _uiState.value.timeRemainingSeconds - 1
                    _uiState.update { it.copy(timeRemainingSeconds = newTime) }
                    // IMAGE_VIEWING hands off to a new 240s timer; return so this coroutine's
                    // finally{} sees a newer timerGeneration and is a no-op (generation-token invariant,
                    // ported verbatim from the Android original -- see its own comment for the race it guards).
                    if (newTime == 0 && advancePhaseOnTimeout()) return@launch
                }
            } finally {
                _uiState.update { current ->
                    if (current.timerStartTime == myGeneration) current.copy(isTimerActive = false) else current
                }
            }
        }
    }

    private fun advancePhaseOnTimeout(): Boolean = when (_uiState.value.currentPhase) {
        PPDTPhase.IMAGE_VIEWING -> { proceedToNextPhase(); true }
        PPDTPhase.WRITING -> { proceedToNextPhase(); false }
        else -> false
    }

    private fun updateUiFromSession() {
        val session = _uiState.value.session ?: return
        _uiState.update {
            it.copy(
                isLoading = false, loadingMessage = null,
                currentPhase = session.currentPhase, imageUrl = session.question.imageUrl,
                story = session.story, charactersCount = session.story.length,
                minCharacters = session.question.minCharacters, maxCharacters = session.question.maxCharacters,
                canProceedToNextPhase = session.story.length >= session.question.minCharacters
            )
        }
    }

}
