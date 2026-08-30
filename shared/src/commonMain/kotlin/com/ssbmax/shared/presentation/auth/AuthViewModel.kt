package com.ssbmax.shared.presentation.auth

import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.domain.usecase.auth.CancelAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.auth.RequestAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.SignInWithGoogleUseCase
import com.ssbmax.shared.domain.usecase.auth.SignOutUseCase
import com.ssbmax.shared.domain.usecase.auth.UpdateUserRoleUseCase
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Koin-injected ViewModel for the auth vertical (Login + RoleSelection),
 * fleshed out in Phase 5 from the Phase 0 spike's login-only stub — full
 * feature parity with the pre-KMP `app/.../ui/auth/AuthViewModel.kt`
 * (role-selection detection, `setUserRole`, `signOut`), minus its
 * Android-`Intent`-specific plumbing.
 *
 * A real `androidx.lifecycle.ViewModel` using `viewModelScope` (Phase 1 of
 * the KMP-convergence plan), converged with `app`'s existing 57-call-site
 * idiom — Compose call sites use `koinViewModel()`, not `koinInject()`.
 *
 * [GoogleSignInLauncher] is deliberately NOT a constructor dependency (see
 * that interface's class doc) -- `LoginScreen` obtains the platform-specific
 * [GoogleSignInData] itself (via `LocalGoogleSignInLauncher`) and hands it to
 * [handleGoogleSignInResult] as a plain parameter.
 */
class AuthViewModel(
    private val signInWithGoogleUseCase: SignInWithGoogleUseCase,
    private val updateUserRoleUseCase: UpdateUserRoleUseCase,
    private val signOutUseCase: SignOutUseCase,
    private val observeCurrentUserUseCase: ObserveCurrentUserUseCase,
    private val requestAccountDeletionUseCase: RequestAccountDeletionUseCase,
    private val cancelAccountDeletionUseCase: CancelAccountDeletionUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Initial)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _accountDeletionState = MutableStateFlow<AccountDeletionState>(AccountDeletionState.Idle)
    val accountDeletionState: StateFlow<AccountDeletionState> = _accountDeletionState.asStateFlow()

    init {
        // Seeds/clears DeletionPending from the reactive Firestore-backed `currentUser` flow
        // (`users/{uid}.deletionRequestedAt`) so the state survives process death -- unlike
        // ConfirmPending/Loading/Error, which only exist mid-flow and must not be clobbered by a
        // stale snapshot arriving while the user is actively confirming/cancelling.
        viewModelScope.launch {
            observeCurrentUserUseCase().collect { user ->
                val isPending = user?.deletionRequestedAt != null
                _accountDeletionState.update { current ->
                    when {
                        isPending && current == AccountDeletionState.Idle -> AccountDeletionState.DeletionPending
                        !isPending && current == AccountDeletionState.DeletionPending -> AccountDeletionState.Idle
                        else -> current
                    }
                }
            }
        }
    }

    /** Show the irreversibility confirmation dialog before calling [confirmAccountDeletion]. */
    fun showAccountDeletionConfirmation() {
        _accountDeletionState.update { AccountDeletionState.ConfirmPending }
    }

    /** Dismiss the confirmation dialog without requesting deletion. */
    fun dismissAccountDeletionConfirmation() {
        _accountDeletionState.update { AccountDeletionState.Idle }
    }

    /** User confirmed deletion: request the grace-period deletion server-side. */
    fun confirmAccountDeletion() {
        viewModelScope.launch {
            _accountDeletionState.update { AccountDeletionState.Loading }
            requestAccountDeletionUseCase()
                .onSuccess { _accountDeletionState.update { AccountDeletionState.DeletionPending } }
                .onFailure { error ->
                    _accountDeletionState.update {
                        AccountDeletionState.Error(error.message ?: "Failed to request account deletion")
                    }
                }
        }
    }

    /** Cancel a pending account deletion within the grace period. */
    fun cancelAccountDeletion() {
        viewModelScope.launch {
            _accountDeletionState.update { AccountDeletionState.Loading }
            cancelAccountDeletionUseCase()
                .onSuccess { _accountDeletionState.update { AccountDeletionState.Idle } }
                .onFailure { error ->
                    _accountDeletionState.update {
                        AccountDeletionState.Error(error.message ?: "Failed to cancel account deletion")
                    }
                }
        }
    }

    /**
     * Handle the result of the platform's Google Sign-In flow (obtained via
     * `GoogleSignInLauncher.signIn()` at the call site). Ported from the
     * Android original's `handleGoogleSignInResult`, minus the
     * Android-`Intent`-unwrapping step (the launcher already produces
     * platform-agnostic [GoogleSignInData]).
     */
    fun handleGoogleSignInResult(data: GoogleSignInData) {
        when (data) {
            is GoogleSignInData.Cancelled -> _uiState.update { AuthUiState.Initial }
            is GoogleSignInData.Error -> {
                _uiState.update { AuthUiState.Error(data.message) }
            }
            else -> viewModelScope.launch {
                _uiState.update { AuthUiState.Loading }
                signInWithGoogleUseCase(data)
                    .onSuccess { user ->
                        _uiState.update {
                            if (needsRoleSelection(user)) {
                                AuthUiState.NeedsRoleSelection(user)
                            } else {
                                AuthUiState.Success(user)
                            }
                        }
                    }
                    .onFailure { error ->
                        _uiState.update { AuthUiState.Error(error.message ?: "Google Sign-In failed") }
                    }
            }
        }
    }

    /**
     * A brand-new user (never logged in before `createdAt == lastLoginAt`)
     * defaults to STUDENT until they explicitly pick a role -- same
     * heuristic as the Android original.
     */
    private fun needsRoleSelection(user: SSBMaxUser): Boolean =
        user.role == UserRole.STUDENT && user.createdAt == user.lastLoginAt

    /** Set user role after Google Sign-In (role-selection screen). */
    fun setUserRole(role: UserRole) {
        viewModelScope.launch {
            _uiState.update { AuthUiState.Loading }
            updateUserRoleUseCase(role)
                .onSuccess {
                    val user = observeCurrentUserUseCase().first()
                    _uiState.update {
                        if (user != null) {
                            AuthUiState.Success(user)
                        } else {
                            AuthUiState.Error("Failed to load updated user")
                        }
                    }
                }
                .onFailure { error ->
                    _uiState.update { AuthUiState.Error(error.message ?: "Failed to set role") }
                }
        }
    }

    /** Sign out the current user. */
    fun signOut() {
        viewModelScope.launch {
            signOutUseCase()
            _uiState.update { AuthUiState.Initial }
        }
    }

    /** Reset UI state (e.g. after showing an error). */
    fun resetState() {
        _uiState.update { AuthUiState.Initial }
    }
}

sealed class AuthUiState {
    data object Initial : AuthUiState()
    data object Loading : AuthUiState()
    data class Success(val user: SSBMaxUser) : AuthUiState()
    data class NeedsRoleSelection(val user: SSBMaxUser) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

/** Shared Android/iOS state for the Delete Account confirm → grace-window → cancel flow. */
sealed class AccountDeletionState {
    data object Idle : AccountDeletionState()
    data object ConfirmPending : AccountDeletionState()
    data object Loading : AccountDeletionState()
    data object DeletionPending : AccountDeletionState()
    data class Error(val message: String) : AccountDeletionState()
}
