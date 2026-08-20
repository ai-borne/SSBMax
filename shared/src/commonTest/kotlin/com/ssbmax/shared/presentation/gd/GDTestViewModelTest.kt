@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.gd

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
 * Characterization test, written before converting [GDTestViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1c of the KMP-convergence plan's
 * strict-SSOT execution plan). Pins the current eligibility -> discussion ->
 * review -> submit state machine so the ViewModel/scope conversion is
 * provably behaviour-preserving: this file must pass unmodified against both
 * the pre- and post-conversion class.
 */
class GDTestViewModelTest {

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

    private fun buildViewModel(): GDTestViewModel {
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
        return GDTestViewModel(
            testContentRepository = testContentRepository,
            submissionRepository = submissionRepository,
            eligibilityChecker = eligibilityChecker,
            submissionCoordinator = submissionCoordinator,
            logger = logger
        )
    }

    @Test
    fun `loadTest surfaces limit reached without loading topic`() = runTest(testDispatcher) {
        subscriptionRepository.tierResult = Result.success(com.ssbmax.shared.domain.model.SubscriptionTier.FREE)
        subscriptionRepository.monthlyUsageResult = Result.success(
            mapOf("GTO" to com.ssbmax.shared.domain.repository.UsageInfo(used = 1, limit = 1))
        )
        val viewModel = buildViewModel()

        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.limitReached)
        assertEquals(1, state.limitReached?.limit)
        assertEquals(false, state.isLoading)
    }

    @Test
    fun `loadTest loads topic when eligible`() = runTest(testDispatcher) {
        testContentRepository.apply { }
        val viewModel = buildViewModel()

        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("topic", state.topic)
        assertEquals(GDPhase.INSTRUCTIONS, state.phase)
    }

    @Test
    fun `startDiscussion moves to discussion phase and starts timer`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.startDiscussion()

        val state = viewModel.uiState.value
        assertEquals(GDPhase.DISCUSSION, state.phase)
        assertEquals(1200, state.timeRemaining)
    }

    @Test
    fun `proceedToReview rejects a response shorter than the minimum`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startDiscussion()
        viewModel.onResponseChanged("too short")

        viewModel.proceedToReview()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertEquals(GDPhase.DISCUSSION, state.phase)
    }

    @Test
    fun `proceedToReview accepts a valid response`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startDiscussion()
        viewModel.onResponseChanged("a".repeat(100))

        viewModel.proceedToReview()

        val state = viewModel.uiState.value
        assertEquals(null, state.validationError)
        assertEquals(GDPhase.REVIEW, state.phase)
    }

    @Test
    fun `submitTest completes and records usage plus progress`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startDiscussion()
        viewModel.onResponseChanged("a".repeat(100))
        viewModel.proceedToReview()

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isCompleted)
        assertEquals(GDPhase.SUBMITTED, state.phase)
        assertNotNull(state.submissionId)
        assertTrue(usageRecorder.recorded.isNotEmpty())
        assertTrue(gtoRepository.recordedProgress.isNotEmpty())
        assertTrue(analysisTrigger.triggeredCalls.isNotEmpty())
    }

    @Test
    fun `submitTest failure surfaces submitError without completing`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTest("gto_gd_standard")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startDiscussion()
        viewModel.onResponseChanged("a".repeat(100))
        viewModel.proceedToReview()
        submissionRepository.submitResult = Result.failure(Exception("network down"))

        viewModel.submitTest()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.submitError)
        assertEquals(false, state.isCompleted)
    }
}
