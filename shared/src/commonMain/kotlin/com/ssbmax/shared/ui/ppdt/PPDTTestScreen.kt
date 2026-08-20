package com.ssbmax.shared.ui.ppdt

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import com.ssbmax.shared.ui.common.SsbBackHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.ppdt.PPDTTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.ppdt.components.PPDTBottomBar
import com.ssbmax.shared.ui.ppdt.components.PPDTExitDialog
import com.ssbmax.shared.ui.ppdt.components.PPDTProfileRequiredDialog
import com.ssbmax.shared.ui.ppdt.components.PPDTSubmitDialog
import com.ssbmax.shared.ui.ppdt.components.PPDTTopBar
import com.ssbmax.shared.ui.ppdt.components.phases.PPDTImageViewingPhase
import com.ssbmax.shared.ui.ppdt.components.phases.PPDTInstructionsPhase
import com.ssbmax.shared.ui.ppdt.components.phases.PPDTReviewPhase
import com.ssbmax.shared.ui.ppdt.components.phases.PPDTWritingPhase
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.ppdt_loading

/**
 * KMP port of `app/.../ui/tests/ppdt/PPDTTestScreen.kt`.
 *
 * Uses `koinViewModel<PPDTTestViewModel>()`, same as
 * [com.ssbmax.shared.ui.oir.OIRTestScreen] -- `viewModelScope` is cancelled
 * automatically on leaving the screen, no manual `DisposableEffect`/`close()`.
 *
 * Navigation on submit follows the OIR precedent too: rather than a
 * `Channel<TestNavigationEvent>` (the Android original's
 * `BaseTestViewModel.navigationEvents`, dropped along with the rest of that
 * WorkManager-coupled base class -- see [PPDTTestViewModel]'s doc comment),
 * a `LaunchedEffect(uiState.isSubmitted)` watches the UiState field directly.
 *
 * `TestContentLoadingState`/`TestContentErrorState` (Android-only,
 * `app/.../ui/components/`) are not ported -- inlined here the same way
 * `OIRTestScreen` inlines its loading/error states, per that screen's own
 * documented precedent.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun PPDTTestScreen(
    testId: String,
    onTestComplete: (submissionId: String, subscriptionType: SubscriptionTier) -> Unit = { _, _ -> },
    onNavigateBack: () -> Unit = {},
    viewModel: PPDTTestViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showExitDialog by rememberSaveable { mutableStateOf(false) }
    var showSubmitDialog by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(testId) {
        viewModel.loadTest(testId)
    }

    // Hardware/predictive back must go through the same exit path as the X button --
    // otherwise it bypasses pauseTest()'s abandonTestSession() call and leaves the durable
    // test_sessions doc stuck ACTIVE (see PPDTTestViewModel.pauseTest doc).
    SsbBackHandler(enabled = uiState.session != null && !uiState.isSubmitted) {
        showExitDialog = true
    }

    LaunchedEffect(uiState.isSubmitted) {
        if (uiState.isSubmitted && uiState.submissionId != null && uiState.subscriptionType != null) {
            onTestComplete(uiState.submissionId!!, uiState.subscriptionType!!)
        }
    }

    if (uiState.isLimitReached) {
        TestLimitReachedDialog(
            tier = uiState.subscriptionTier,
            testsLimit = uiState.testsLimit,
            testsUsed = uiState.testsUsed,
            resetsAt = uiState.resetsAt,
            onUpgrade = { onNavigateBack() },
            onDismiss = onNavigateBack
        )
        return
    }

    if (uiState.isProfileIncomplete) {
        PPDTProfileRequiredDialog(onGoToSettings = onNavigateBack, onDismiss = onNavigateBack)
        return
    }

    Scaffold(
        topBar = {
            PPDTTopBar(
                currentPhase = uiState.currentPhase,
                timeRemainingSeconds = uiState.timeRemainingSeconds,
                onExitClick = { showExitDialog = true }
            )
        },
        bottomBar = {
            if (uiState.currentPhase != PPDTPhase.INSTRUCTIONS) {
                PPDTBottomBar(
                    currentPhase = uiState.currentPhase,
                    canProceed = uiState.canProceedToNextPhase,
                    onNext = { viewModel.proceedToNextPhase() },
                    onSubmit = { showSubmitDialog = true }
                )
            }
        },
        modifier = modifier
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                uiState.isLoading -> LoadingState()
                uiState.error != null -> TestErrorState(error = uiState.error!!, onRetry = { viewModel.loadTest() })
                else -> when (uiState.currentPhase) {
                    PPDTPhase.INSTRUCTIONS -> PPDTInstructionsPhase(onStart = { viewModel.startTest() })
                    PPDTPhase.IMAGE_VIEWING -> PPDTImageViewingPhase(
                        imageUrl = uiState.imageUrl,
                        timeRemainingSeconds = uiState.timeRemainingSeconds
                    )
                    PPDTPhase.WRITING -> PPDTWritingPhase(
                        story = uiState.story,
                        onStoryChange = { viewModel.updateStory(it) },
                        charactersCount = uiState.charactersCount,
                        minCharacters = uiState.minCharacters,
                        maxCharacters = uiState.maxCharacters
                    )
                    PPDTPhase.REVIEW -> PPDTReviewPhase(
                        imageUrl = uiState.imageUrl,
                        story = uiState.story,
                        charactersCount = uiState.charactersCount,
                        onEdit = { viewModel.returnToWriting() }
                    )
                    PPDTPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
                }
            }
        }
    }

    if (showExitDialog) {
        PPDTExitDialog(
            onDismiss = { showExitDialog = false },
            onExit = { viewModel.pauseTest(); onNavigateBack() }
        )
    }

    if (showSubmitDialog) {
        PPDTSubmitDialog(
            onDismiss = { showSubmitDialog = false },
            onSubmit = { showSubmitDialog = false; viewModel.submitTest() }
        )
    }
}

@Composable
private fun LoadingState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator()
            Text(text = stringResource(Res.string.ppdt_loading), style = MaterialTheme.typography.bodyMedium)
        }
    }
}
