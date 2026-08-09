package com.ssbmax.shared.ui.settings

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.presentation.settings.SubscriptionManagementUiState
import com.ssbmax.shared.presentation.settings.SubscriptionManagementViewModel
import com.ssbmax.shared.presentation.settings.SubscriptionTierModel
import com.ssbmax.shared.presentation.settings.UsageInfo
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class SubscriptionManagementScreenUiTest {

    private lateinit var mockViewModel: SubscriptionManagementViewModel
    private lateinit var uiStateFlow: MutableStateFlow<SubscriptionManagementUiState>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(SubscriptionManagementUiState())
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun loadingState_exposesLoadingSemantics() = runComposeUiTest {
        uiStateFlow.value = SubscriptionManagementUiState(isLoading = true)
        setContent {
            SubscriptionManagementScreen(
                onNavigateBack = {},
                onUpgrade = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Loading subscription data").assertIsDisplayed()
    }

    @Test
    fun errorState_exposesRetryAction() = runComposeUiTest {
        uiStateFlow.value = SubscriptionManagementUiState(
            isLoading = false,
            error = "Failed to load subscription data"
        )
        setContent {
            SubscriptionManagementScreen(
                onNavigateBack = {},
                onUpgrade = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Failed to load subscription data").assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.loadSubscriptionData() }
    }

    @Test
    fun populatedState_displaysPlanAndUsage() = runComposeUiTest {
        uiStateFlow.value = SubscriptionManagementUiState(
            currentTier = SubscriptionTierModel.FREE,
            monthlyUsage = mapOf("OIR" to UsageInfo(used = 1, limit = 1))
        )
        setContent {
            SubscriptionManagementScreen(
                onNavigateBack = {},
                onUpgrade = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Subscription & Billing").assertIsDisplayed()
        onAllNodesWithText("Free").onFirst().assertIsDisplayed()
        onNodeWithText("Compare Plans").assertIsDisplayed()
    }

    @Test
    fun backAction_isLabeledAndNavigates() = runComposeUiTest {
        var navigatedBack = false
        setContent {
            SubscriptionManagementScreen(
                onNavigateBack = { navigatedBack = true },
                onUpgrade = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Back").performClick()
        check(navigatedBack)
    }
}
