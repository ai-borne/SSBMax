package com.ssbmax.shared.ui.profile

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.presentation.profile.StudentProfileUiState
import com.ssbmax.shared.presentation.profile.StudentProfileViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/profile/StudentProfileScreenTest.kt`
 * onto shared's [StudentProfileScreen] -- Phase 6a-2 of the KMP-convergence
 * plan, closing one of the five coverage gaps 6a named but deliberately
 * deferred.
 *
 * Real structural drift from the pre-cutover test this replaces, verified by
 * reading [StudentProfileScreen]/[StudentProfileHeader]/[StudentProfileSections]
 * rather than assumed:
 * - `profileScreen_showsLoadingState` originally asserted on a "Loading" text
 *   node that never existed here -- [StudentProfileUiState.isLoading] was
 *   dead (no conditional branch anywhere) until this same phase's follow-up
 *   fix wired a `CircularProgressIndicator` into [StudentProfileScreen].
 *   Since that indicator has no text, `profileScreen_loadingState_hidesContent`
 *   asserts the loaded content is absent instead of asserting the spinner
 *   directly.
 * - `profileScreen_logoutButton_isVisible`: no "Logout" string or composable
 *   exists anywhere under `shared/ui/profile` -- the Android original's
 *   logout action isn't reachable from this screen in the port (likely
 *   moved behind `onNavigateToSettings`, out of this screen's scope).
 *   `profileScreen_displaysPremiumBadge` covers a real conditional branch
 *   ([ProfileHeader]'s `isPremium` chip) in its place.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class StudentProfileScreenUiTest {

    private lateinit var mockViewModel: StudentProfileViewModel
    private lateinit var uiStateFlow: MutableStateFlow<StudentProfileUiState>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            StudentProfileUiState(userName = "John Doe", userEmail = "john@example.com", isLoading = false)
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun profileScreen_displaysUserName() = runComposeUiTest {
        setContent { StudentProfileScreen(viewModel = mockViewModel) }

        onNodeWithText("John Doe").assertIsDisplayed()
    }

    @Test
    fun profileScreen_displaysUserInfo() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(totalTestsAttempted = 10, streakDays = 5)
        setContent { StudentProfileScreen(viewModel = mockViewModel) }

        onNodeWithText("10").assertIsDisplayed()
        onNodeWithText("5").assertIsDisplayed()
    }

    @Test
    fun profileScreen_displaysEmail() = runComposeUiTest {
        setContent { StudentProfileScreen(viewModel = mockViewModel) }

        onNodeWithText("john@example.com", substring = true).assertIsDisplayed()
    }

    @Test
    fun profileScreen_displaysPremiumBadge() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isPremium = true)
        setContent { StudentProfileScreen(viewModel = mockViewModel) }

        onNodeWithText("Premium Member", substring = true).assertIsDisplayed()
    }

    @Test
    fun profileScreen_loadingState_hidesContent() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { StudentProfileScreen(viewModel = mockViewModel) }

        onNodeWithText("John Doe").assertDoesNotExist()
        onNodeWithContentDescription("Loading profile").assertIsDisplayed()
    }
}
