@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.interviewstart

import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.usecase.CheckInterviewPrerequisitesUseCase
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeQuestionCacheRepository
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeSubscriptionRepository
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Characterization test for [StartInterviewViewModel], written retroactively (13-VM
 * gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the current
 * history-load -> eligibility-check -> session-creation state machine so this
 * ViewModel is protected by a regression test like the other 48 Phase 1 conversions.
 */
class StartInterviewViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var subscriptionRepository: FakeSubscriptionRepository
    private lateinit var interviewRepository: FakeInterviewRepository
    private lateinit var submissionRepository: FakeSubmissionRepository
    private lateinit var questionCacheRepository: FakeQuestionCacheRepository
    private lateinit var developerSettings: DeveloperSettings

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        subscriptionRepository = FakeSubscriptionRepository()
        interviewRepository = FakeInterviewRepository()
        submissionRepository = FakeSubmissionRepository()
        questionCacheRepository = FakeQuestionCacheRepository()
        developerSettings = DeveloperSettings(FakeSettings())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = StartInterviewViewModel(
        checkPrerequisites = CheckInterviewPrerequisitesUseCase(
            submissionRepository = submissionRepository,
            subscriptionRepository = subscriptionRepository,
            interviewRepository = interviewRepository
        ),
        interviewRepository = interviewRepository,
        submissionRepository = submissionRepository,
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        questionCacheRepository = questionCacheRepository,
        developerSettings = developerSettings,
        logger = NoOpLogger()
    )

    @Test
    fun `loads past interview history on init`() = runTest(testDispatcher) {
        val completedAt = kotlin.time.Instant.fromEpochMilliseconds(1_000)
        interviewRepository.userResultsFlow = flowOf(
            listOf(
                com.ssbmax.shared.domain.model.interview.InterviewResult(
                    id = "result-1",
                    sessionId = "session-1",
                    userId = testUser().id,
                    mode = InterviewMode.VOICE_BASED,
                    completedAt = completedAt,
                    durationSec = 600,
                    totalQuestions = 5,
                    totalResponses = 5,
                    overallOLQScores = emptyMap(),
                    categoryScores = emptyMap(),
                    overallConfidence = 80,
                    strengths = emptyList(),
                    weaknesses = emptyList(),
                    feedback = "Good effort",
                    overallRating = 5
                )
            )
        )

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(1, state.pastResults.size)
        assertFalse(state.isLoadingHistory)
    }

    @Test
    fun `checkEligibility surfaces failure reasons when prerequisites are unmet`() = runTest(testDispatcher) {
        // Default fakes: no PIQ/OIR/PPDT submissions -> all prerequisites NotStarted.
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isEligible)
        assertFalse(state.isLoading)
        assertTrue(state.getFailureReasons().isNotEmpty())
    }

    /** Dev-subscription-override plan Phase 10: a genuine interview limit now populates
     * `limitReached` (rendered through the shared `TestLimitReachedDialog`) instead of only a
     * `failureReasons` sentence. */
    @Test
    fun `checkEligibility surfaces limitReached when a genuine interview limit is hit`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(com.ssbmax.shared.domain.model.SubscriptionTier.PRO)
        interviewRepository.interviewStatsResult = Result.success(
            mapOf(InterviewMode.VOICE_BASED to 3)
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        val limitReached = state.getLimitReached()
        assertEquals(com.ssbmax.shared.domain.model.SubscriptionTier.PRO, limitReached?.tier)
        assertEquals(3, limitReached?.limit)
        assertEquals(3, limitReached?.usedCount)
        assertTrue(state.getFailureReasons().none { it.contains("Interview limit reached") })
    }

    /**
     * Dev-subscription-override plan Phase 6: `BYPASS_INTERVIEW_PREREQUISITES` used to be dead --
     * the `BuildConfig` field existed but this ViewModel hardcoded both use-case bypass params
     * `false` regardless. This pins that `DeveloperSettings.bypassInterviewPrerequisites` now
     * genuinely drives both, unblocking eligibility with no PIQ/OIR/PPDT submissions present.
     */
    @Test
    fun `checkEligibility bypasses prerequisites when developer setting is enabled`() = runTest(testDispatcher) {
        developerSettings.setBypassInterviewPrerequisites(true)
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isEligible)
        assertTrue(state.getFailureReasons().isEmpty())
    }

    @Test
    fun `checkEligibility blocks unauthenticated access`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("Authentication required", viewModel.uiState.value.error)
    }

    @Test
    fun `createSession is blocked when prerequisites are not met`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.createSession(consentGiven = true)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("Prerequisites not met", viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isSessionCreated)
    }

    @Test
    fun `clearError resets the error field`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.checkEligibility()
        testDispatcher.scheduler.advanceUntilIdle()
        assertTrue(viewModel.uiState.value.error != null)

        viewModel.clearError()

        assertEquals(null, viewModel.uiState.value.error)
    }
}
