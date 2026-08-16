package com.ssbmax.shared.ui.srt

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import com.ssbmax.shared.domain.model.SRTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.srt.SRTTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.srt.components.SRTExitDialog
import com.ssbmax.shared.ui.srt.components.SRTInProgressPhase
import com.ssbmax.shared.ui.srt.components.SRTInstructionsPhase
import com.ssbmax.shared.ui.srt.components.SRTReviewPhase
import com.ssbmax.shared.ui.srt.components.SRTSubmitDialog
import com.ssbmax.shared.ui.srt.components.SRTTimeUpDialog
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.srt_loading

/**
 * KMP port of `app/.../ui/tests/srt/SRTTestScreen.kt`.
 *
 * Uses `koinViewModel<SRTTestViewModel>()`, same as
 * [com.ssbmax.shared.ui.wat.WATTestScreen]/[com.ssbmax.shared.ui.tat.TATTestScreen] --
 * `viewModelScope` is cancelled automatically on leaving the screen, no
 * manual `DisposableEffect`/`close()`.
 *
 * Navigation on submit follows the same precedent: a
 * `LaunchedEffect(uiState.isSubmitted)` watches the UiState field directly,
 * rather than the Android original's `Channel<TestNavigationEvent>`.
 *
 * Unlike WAT: SRT has a genuine REVIEW phase (see [SRTReviewPhase]) and an
 * explicit submit-confirmation dialog ([SRTSubmitDialog]), plus a
 * non-dismissible time's-up dialog ([SRTTimeUpDialog]) -- both real behaviors
 * of the Android original's state machine, not new additions.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun SRTTestScreen(
    testId: String,
    onTestComplete: (submissionId: String, subscriptionType: SubscriptionTier) -> Unit = { _, _ -> },
    onNavigateBack: () -> Unit = {},
    viewModel: SRTTestViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showExitDialog by rememberSaveable { mutableStateOf(false) }
    var showSubmitDialog by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(testId) {
        viewModel.loadTest(testId)
    }

    LaunchedEffect(uiState.isSubmitted) {
        if (uiState.isSubmitted && uiState.submissionId != null && uiState.subscriptionType != null) {
            onTestComplete(uiState.submissionId!!, uiState.subscriptionType!!)
        }
    }

    // Hardware/predictive back must go through the same exit path as the in-progress "exit"
    // action -- otherwise it silently pops the nav stack and leaves the durable test_sessions
    // doc stuck ACTIVE (see PPDTTestScreen's identical fix for the same bug).
    SsbBackHandler(enabled = uiState.situations.isNotEmpty() && !uiState.isSubmitted) {
        showExitDialog = true
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

    Box(modifier = modifier.fillMaxSize()) {
        when {
            uiState.isLoading -> LoadingState(modifier = Modifier.fillMaxSize())
            uiState.error != null -> TestErrorState(
                error = uiState.error!!,
                onRetry = { viewModel.loadTest(testId) },
                modifier = Modifier.fillMaxSize()
            )
            else -> when (uiState.phase) {
                SRTPhase.INSTRUCTIONS -> SRTInstructionsPhase(onStart = { viewModel.startTest() })
                SRTPhase.IN_PROGRESS -> SRTInProgressPhase(
                    situation = uiState.currentSituation?.situation ?: "",
                    situationNumber = uiState.currentSituationIndex + 1,
                    totalSituations = uiState.situations.size,
                    timeRemaining = uiState.timeRemaining,
                    response = uiState.currentResponse,
                    onResponseChange = { viewModel.updateResponse(it) },
                    minChars = uiState.config?.minResponseLength ?: 0,
                    maxChars = uiState.config?.maxResponseLength ?: 200,
                    canMoveNext = uiState.canMoveToNext,
                    onNext = { viewModel.moveToNext() },
                    onSkip = { viewModel.skipSituation() },
                    onShowExitDialog = { showExitDialog = true }
                )
                SRTPhase.REVIEW -> SRTReviewPhase(
                    responses = uiState.responses,
                    totalSituations = uiState.situations.size,
                    onEdit = { index -> viewModel.editResponse(index) },
                    onSubmit = { showSubmitDialog = true }
                )
                SRTPhase.COMPLETED, SRTPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
            }
        }
    }

    if (showExitDialog) {
        SRTExitDialog(
            onDismiss = { showExitDialog = false },
            onExit = { showExitDialog = false; viewModel.pauseTest(); onNavigateBack() }
        )
    }

    if (showSubmitDialog) {
        SRTSubmitDialog(
            validResponseCount = uiState.validResponseCount,
            totalSituations = uiState.situations.size,
            onDismiss = { showSubmitDialog = false },
            onConfirm = { showSubmitDialog = false; viewModel.submitTest() }
        )
    }

    if (uiState.isTimeUp) {
        SRTTimeUpDialog()
    }
}

@Composable
private fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator()
            Text(text = stringResource(Res.string.srt_loading), style = MaterialTheme.typography.bodyMedium)
        }
    }
}
