@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.studenttests

import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeTestProgressRepository
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

/**
 * Characterization test for [StudentTestsViewModel], written retroactively
 * (13-VM gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the
 * current flattened "All Tests" list built from Phase 1 + Phase 2 progress
 * (2 Phase 1 items + 13 Phase 2 items, see the ViewModel's own hardcoded list).
 */
class StudentTestsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var testProgressRepository: FakeTestProgressRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        testProgressRepository = FakeTestProgressRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = StudentTestsViewModel(
        testProgressRepository = testProgressRepository,
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        logger = NoOpLogger()
    )

    @Test
    fun `loads phase 1 and phase 2 test overview lists on init`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals(null, state.error)
        assertEquals(2, state.phase1Tests.size)
        assertEquals(14, state.phase2Tests.size)
        assertEquals(TestType.OIR, state.phase1Tests[0].type)
        assertEquals(TestStatus.NOT_ATTEMPTED, state.phase1Tests[0].status)
    }

    @Test
    fun `blocks unauthenticated access with a login prompt`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("Please login to view your tests", state.error)
        assertEquals(emptyList(), state.phase1Tests)
    }

    @Test
    fun `reflects a completed OIR test's score`() = runTest(testDispatcher) {
        testProgressRepository.phase1Flow = flowOf(
            Phase1Progress(
                oirProgress = TestProgress(TestType.OIR, status = TestStatus.GRADED, latestScore = 72f),
                ppdtProgress = TestProgress(TestType.PPDT)
            )
        )
        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        val oirTest = viewModel.uiState.value.phase1Tests.first { it.type == TestType.OIR }
        assertEquals(TestStatus.GRADED, oirTest.status)
        assertEquals(72f, oirTest.latestScore)
    }
}
