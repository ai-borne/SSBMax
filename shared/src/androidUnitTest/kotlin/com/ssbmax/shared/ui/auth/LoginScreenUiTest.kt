package com.ssbmax.shared.ui.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.platform.auth.GoogleSignInLauncher
import com.ssbmax.shared.presentation.auth.AuthUiState
import com.ssbmax.shared.presentation.auth.AuthViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.koin.compose.KoinApplication
import org.koin.dsl.module
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/auth/LoginScreenTest.kt`
 * (Phase 6a of the KMP-convergence plan) onto the shared [LoginScreen], the
 * production auth screen since Phase 5's cutover.
 *
 * Lives in `androidUnitTest`, not `commonTest` -- same precedent as
 * [com.ssbmax.shared.ui.theme.SSBMaxThemeUiTest]: `runComposeUiTest`'s Android
 * host needs Robolectric, which has no Kotlin/Native equivalent.
 *
 * Real structural difference from the pre-cutover test this replaces:
 * [LoginScreen] no longer accepts a `viewModel` constructor parameter (it
 * resolves `koinViewModel<AuthViewModel>()` internally, unlike the
 * test-taking screens which kept the override param). The mock is installed
 * via the `org.koin.compose.KoinApplication` composable -- an ISOLATED,
 * composition-scoped Koin instance (`LocalKoinApplication`/`LocalKoinScope`),
 * not the process-global `startKoin()`/`stopKoin()` `SSBMaxApplication` uses.
 * Global start/stop was tried first and rejected: Robolectric's
 * `runComposeUiTest` host reuses composition/view-tree state across test
 * methods in the same class run, so a later test's `koinViewModel()` call
 * could resolve a `KoinViewModelFactory` closure still bound to an earlier
 * test's already-`stopKoin()`-ed global scope (`ClosedScopeException`,
 * confirmed empirically) -- an isolated per-test `KoinApplication` sidesteps
 * that class of ordering hazard entirely.
 * [LocalGoogleSignInLauncher] has no default (see its class doc), so a fake
 * is provided explicitly via `CompositionLocalProvider`.
 */
// LoginScreen has no internal scroll container and lays out to ~480dp tall
// (logo block + welcome text + button + optional error card + bottom terms
// text). Robolectric's default device config is a small ~320dp-tall window,
// which clips everything below the fold -- `assertIsDisplayed()` then fails
// (not off-tree, just off-screen) for the loading indicator, error card, and
// terms text. A tall qualifier avoids depending on Robolectric's default.
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1200dp")
class LoginScreenUiTest {

    private lateinit var mockViewModel: AuthViewModel
    private lateinit var uiStateFlow: MutableStateFlow<AuthUiState>
    private val fakeLauncher = object : GoogleSignInLauncher {
        override suspend fun signIn(): GoogleSignInData = GoogleSignInData.Cancelled
    }

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(AuthUiState.Initial)
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun loginScreen_displaysCorrectly() = runComposeUiTest {
        setContent { withTestDependencies { LoginScreen() } }

        onNodeWithText("SSBMax").assertIsDisplayed()
        onNodeWithText("Your Path to SSB Success").assertIsDisplayed()
        onNodeWithText("Welcome!").assertIsDisplayed()
        onNodeWithText("Continue with Google").assertIsDisplayed()
        onNodeWithTag("google_signin_button").assertIsDisplayed().assertIsEnabled()
    }

    @Test
    fun loadingState_showsLoadingIndicator_andDisablesButton() = runComposeUiTest {
        uiStateFlow.value = AuthUiState.Loading
        setContent { withTestDependencies { LoginScreen() } }

        onNodeWithTag("loading_indicator").assertIsDisplayed()
        onNodeWithContentDescription("Continue with Google").assertIsDisplayed()
        onNodeWithTag("google_signin_button").assertIsNotEnabled()
    }

    @Test
    fun errorState_displaysErrorMessage() = runComposeUiTest {
        val errorMessage = "Google Sign-In failed. Please try again."
        uiStateFlow.value = AuthUiState.Error(errorMessage)
        setContent { withTestDependencies { LoginScreen() } }

        onNodeWithTag("error_message").assertIsDisplayed()
        onNodeWithText(errorMessage, substring = true).assertIsDisplayed()
    }

    @Test
    fun successState_triggersNavigation() = runComposeUiTest {
        var loginSuccessCalled = false
        val user = SSBMaxUser(
            id = "test-123",
            email = "test@example.com",
            displayName = "Test User",
            role = UserRole.STUDENT,
            createdAt = 1L,
            lastLoginAt = 10_000L // not first login
        )
        setContent {
            withTestDependencies {
                LoginScreen(onLoginSuccess = { loginSuccessCalled = true })
            }
        }

        uiStateFlow.value = AuthUiState.Success(user)
        waitUntil(timeoutMillis = 3_000) { loginSuccessCalled }
    }

    @Test
    fun needsRoleSelectionState_triggersRoleSelectionNavigation() = runComposeUiTest {
        var roleSelectionCalled = false
        val user = SSBMaxUser(
            id = "test-456",
            email = "newuser@example.com",
            displayName = "New User",
            role = UserRole.STUDENT,
            createdAt = 5_000L,
            lastLoginAt = 5_000L // first login: createdAt == lastLoginAt
        )
        setContent {
            withTestDependencies {
                LoginScreen(onNeedsRoleSelection = { roleSelectionCalled = true })
            }
        }

        uiStateFlow.value = AuthUiState.NeedsRoleSelection(user)
        waitUntil(timeoutMillis = 3_000) { roleSelectionCalled }
    }

    @Test
    fun termsAndPrivacyText_isDisplayed() = runComposeUiTest {
        setContent { withTestDependencies { LoginScreen() } }

        onNodeWithText(
            "By continuing, you agree to our Terms of Service and Privacy Policy",
            substring = true
        ).assertIsDisplayed()
    }

    @Composable
    private fun withTestDependencies(content: @Composable () -> Unit) {
        KoinApplication(application = { modules(module { single { mockViewModel } }) }) {
            CompositionLocalProvider(LocalGoogleSignInLauncher provides fakeLauncher) {
                content()
            }
        }
    }
}
