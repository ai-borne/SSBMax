package com.ssbmax.shared.presentation.auth

import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.domain.usecase.auth.CancelAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.auth.RequestAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.SignInWithGoogleUseCase
import com.ssbmax.shared.domain.usecase.auth.SignOutUseCase
import com.ssbmax.shared.domain.usecase.auth.UpdateUserRoleUseCase
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
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
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Characterization test, written before converting [AuthViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan). Pins
 * the current state-machine behaviour so the conversion is provably
 * behaviour-preserving: this file must pass unmodified against both the
 * pre- and post-conversion class.
 */
class AuthViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = AuthViewModel(
        signInWithGoogleUseCase = SignInWithGoogleUseCase(authRepository),
        updateUserRoleUseCase = UpdateUserRoleUseCase(authRepository),
        signOutUseCase = SignOutUseCase(authRepository),
        observeCurrentUserUseCase = ObserveCurrentUserUseCase(authRepository),
        requestAccountDeletionUseCase = RequestAccountDeletionUseCase(authRepository),
        cancelAccountDeletionUseCase = CancelAccountDeletionUseCase(authRepository)
    )

    @Test
    fun `initial state is Initial`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        assertIs<AuthUiState.Initial>(viewModel.uiState.value)
    }

    @Test
    fun `cancelled google sign-in resets to Initial`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.handleGoogleSignInResult(GoogleSignInData.Cancelled)

        assertIs<AuthUiState.Initial>(viewModel.uiState.value)
    }

    @Test
    fun `google sign-in error surfaces the message`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.handleGoogleSignInResult(GoogleSignInData.Error("provider error"))

        val state = assertIs<AuthUiState.Error>(viewModel.uiState.value)
        assertEquals("provider error", state.message)
    }

    @Test
    fun `successful sign-in of a returning user yields Success`() = runTest(testDispatcher) {
        val user = testUser().copy(createdAt = 1000L, lastLoginAt = 5000L)
        authRepository.handleGoogleSignInResultFn = { Result.success(user) }
        val viewModel = buildViewModel()

        viewModel.handleGoogleSignInResult(GoogleSignInData.ResultData(platformData = Unit))
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AuthUiState.Success>(viewModel.uiState.value)
        assertEquals(user, state.user)
    }

    @Test
    fun `brand-new student user needs role selection`() = runTest(testDispatcher) {
        val user = testUser().copy(role = UserRole.STUDENT, createdAt = 42L, lastLoginAt = 42L)
        authRepository.handleGoogleSignInResultFn = { Result.success(user) }
        val viewModel = buildViewModel()

        viewModel.handleGoogleSignInResult(GoogleSignInData.ResultData(platformData = Unit))
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AuthUiState.NeedsRoleSelection>(viewModel.uiState.value)
        assertEquals(user, state.user)
    }

    @Test
    fun `failed google sign-in surfaces error message`() = runTest(testDispatcher) {
        authRepository.handleGoogleSignInResultFn = { Result.failure(Exception("network down")) }
        val viewModel = buildViewModel()

        viewModel.handleGoogleSignInResult(GoogleSignInData.ResultData(platformData = Unit))
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AuthUiState.Error>(viewModel.uiState.value)
        assertEquals("network down", state.message)
    }

    @Test
    fun `setUserRole success reloads current user as Success`() = runTest(testDispatcher) {
        val user = testUser().copy(role = UserRole.INSTRUCTOR)
        val viewModel = buildViewModel()
        authRepository.userFlow.value = user

        viewModel.setUserRole(UserRole.INSTRUCTOR)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AuthUiState.Success>(viewModel.uiState.value)
        assertEquals(user, state.user)
    }

    @Test
    fun `setUserRole failure surfaces error`() = runTest(testDispatcher) {
        authRepository.updateUserRoleResult = Result.failure(Exception("update failed"))
        val viewModel = buildViewModel()

        viewModel.setUserRole(UserRole.INSTRUCTOR)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AuthUiState.Error>(viewModel.uiState.value)
        assertEquals("update failed", state.message)
    }

    @Test
    fun `signOut resets to Initial`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.handleGoogleSignInResult(GoogleSignInData.Error("boom"))
        assertTrue(viewModel.uiState.value is AuthUiState.Error)

        viewModel.signOut()
        testDispatcher.scheduler.advanceUntilIdle()

        assertIs<AuthUiState.Initial>(viewModel.uiState.value)
    }

    @Test
    fun `resetState resets to Initial`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.handleGoogleSignInResult(GoogleSignInData.Error("boom"))

        viewModel.resetState()

        assertIs<AuthUiState.Initial>(viewModel.uiState.value)
    }

    @Test
    fun `initial account deletion state is Idle`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        assertIs<AccountDeletionState.Idle>(viewModel.accountDeletionState.value)
    }

    @Test
    fun `showAccountDeletionConfirmation moves to ConfirmPending without calling the callable`() =
        runTest(testDispatcher) {
            val viewModel = buildViewModel()

            viewModel.showAccountDeletionConfirmation()

            assertIs<AccountDeletionState.ConfirmPending>(viewModel.accountDeletionState.value)
        }

    @Test
    fun `dismissAccountDeletionConfirmation returns to Idle without calling the callable`() =
        runTest(testDispatcher) {
            authRepository.requestAccountDeletionResult = Result.failure(Exception("should not be called"))
            val viewModel = buildViewModel()
            viewModel.showAccountDeletionConfirmation()

            viewModel.dismissAccountDeletionConfirmation()

            assertIs<AccountDeletionState.Idle>(viewModel.accountDeletionState.value)
        }

    @Test
    fun `confirmAccountDeletion success moves to DeletionPending`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.showAccountDeletionConfirmation()

        viewModel.confirmAccountDeletion()
        testDispatcher.scheduler.advanceUntilIdle()

        assertIs<AccountDeletionState.DeletionPending>(viewModel.accountDeletionState.value)
    }

    @Test
    fun `confirmAccountDeletion failure surfaces error`() = runTest(testDispatcher) {
        authRepository.requestAccountDeletionResult = Result.failure(Exception("network down"))
        val viewModel = buildViewModel()

        viewModel.confirmAccountDeletion()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AccountDeletionState.Error>(viewModel.accountDeletionState.value)
        assertEquals("network down", state.message)
    }

    @Test
    fun `cancelAccountDeletion success returns to Idle`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.confirmAccountDeletion()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.cancelAccountDeletion()
        testDispatcher.scheduler.advanceUntilIdle()

        assertIs<AccountDeletionState.Idle>(viewModel.accountDeletionState.value)
    }

    @Test
    fun `cancelAccountDeletion failure surfaces error`() = runTest(testDispatcher) {
        authRepository.cancelAccountDeletionResult = Result.failure(Exception("already purged"))
        val viewModel = buildViewModel()

        viewModel.cancelAccountDeletion()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = assertIs<AccountDeletionState.Error>(viewModel.accountDeletionState.value)
        assertEquals("already purged", state.message)
    }

    @Test
    fun `seeds DeletionPending from a persisted deletionRequestedAt on the current user`() =
        runTest(testDispatcher) {
            // Regression test for the KMP-web parity gap found in Phase 4 review: without this,
            // killing the app while a deletion is pending would show "Delete Account" again on
            // relaunch instead of "Cancel Deletion", since accountDeletionState previously only
            // changed via the confirm/cancel button flow, never from the persisted user doc.
            authRepository.userFlow.value = testUser().copy(deletionRequestedAt = 1_700_000_000_000L)
            val viewModel = buildViewModel()
            testDispatcher.scheduler.advanceUntilIdle()

            assertIs<AccountDeletionState.DeletionPending>(viewModel.accountDeletionState.value)
        }

    @Test
    fun `clears DeletionPending back to Idle when deletionRequestedAt is cleared on another device`() =
        runTest(testDispatcher) {
            authRepository.userFlow.value = testUser().copy(deletionRequestedAt = 1_700_000_000_000L)
            val viewModel = buildViewModel()
            testDispatcher.scheduler.advanceUntilIdle()
            assertIs<AccountDeletionState.DeletionPending>(viewModel.accountDeletionState.value)

            authRepository.userFlow.value = testUser().copy(deletionRequestedAt = null)
            testDispatcher.scheduler.advanceUntilIdle()

            assertIs<AccountDeletionState.Idle>(viewModel.accountDeletionState.value)
        }

    @Test
    fun `does not clobber an in-flight ConfirmPending when the user flow re-emits`() =
        runTest(testDispatcher) {
            val viewModel = buildViewModel()
            viewModel.showAccountDeletionConfirmation()

            // A currentUser re-emission (e.g. an unrelated profile field changing) must not
            // reset the confirm dialog the user has open back to Idle/DeletionPending.
            authRepository.userFlow.value = testUser()
            testDispatcher.scheduler.advanceUntilIdle()

            assertIs<AccountDeletionState.ConfirmPending>(viewModel.accountDeletionState.value)
        }
}
