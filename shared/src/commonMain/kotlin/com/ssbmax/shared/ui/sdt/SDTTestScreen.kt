package com.ssbmax.shared.ui.sdt

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
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
import com.ssbmax.shared.domain.model.SDTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.sdt.SDTTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.sdt.components.SDTExitDialog
import com.ssbmax.shared.ui.sdt.components.SDTInProgressPhase
import com.ssbmax.shared.ui.sdt.components.SDTInstructionsPhase
import com.ssbmax.shared.ui.sdt.components.SDTReviewPhase
import com.ssbmax.shared.ui.sdt.components.SDTSubmitDialog
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_loading

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestScreen.kt`.
 *
 * Uses `koinViewModel<SDTTestViewModel>()`, same as
 * [com.ssbmax.shared.ui.srt.SRTTestScreen]/[com.ssbmax.shared.ui.wat.WATTestScreen] --
 * `viewModelScope` is cancelled automatically on leaving the screen, no
 * manual `DisposableEffect`/`close()`.
 *
 * Navigation on submit follows the same precedent: a
 * `LaunchedEffect(uiState.isSubmitted)` watches the UiState field directly,
 * rather than the Android original's `Channel<TestNavigationEvent>`.
 *
 * Like SRT: a genuine REVIEW phase ([SDTReviewPhase]) and an explicit
 * submit-confirmation dialog ([SDTSubmitDialog]); unlike SRT, no
 * non-dismissible "Time's Up" dialog -- the Android original silently rolls
 * the timer expiry straight into REVIEW without an interstitial dialog,
 * confirmed by reading the real `SDTTestViewModel.startTimer()`.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun SDTTestScreen(
    testId: String,
    onTestComplete: (submissionId: String, subscriptionType: SubscriptionTier) -> Unit = { _, _ -> },
    onNavigateBack: () -> Unit = {},
    viewModel: SDTTestViewModel = koinViewModel(),
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
    SsbBackHandler(enabled = uiState.questions.isNotEmpty() && !uiState.isSubmitted) {
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
                SDTPhase.INSTRUCTIONS -> SDTInstructionsPhase(onStart = { viewModel.startTest() })
                SDTPhase.IN_PROGRESS -> SDTInProgressPhase(
                    question = uiState.currentQuestion?.question ?: "",
                    questionNumber = uiState.currentQuestionIndex + 1,
                    totalQuestions = uiState.questions.size,
                    answer = uiState.currentAnswer,
                    onAnswerChange = { viewModel.updateAnswer(it) },
                    charCount = uiState.currentCharCount,
                    minChars = uiState.config?.minCharsPerQuestion ?: 50,
                    maxChars = uiState.config?.maxCharsPerQuestion ?: 1500,
                    timeRemaining = uiState.totalTimeRemaining,
                    canMoveNext = uiState.canMoveToNext,
                    onNext = { viewModel.moveToNext() },
                    onSkip = { viewModel.skipQuestion() },
                    onShowExitDialog = { showExitDialog = true }
                )
                SDTPhase.REVIEW -> SDTReviewPhase(
                    questions = uiState.questions,
                    responses = uiState.responses,
                    onEdit = { index -> viewModel.editQuestion(index) },
                    onSubmit = { showSubmitDialog = true }
                )
                SDTPhase.COMPLETED, SDTPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
            }
        }
    }

    if (showExitDialog) {
        SDTExitDialog(
            onDismiss = { showExitDialog = false },
            onExit = { showExitDialog = false; viewModel.pauseTest(); onNavigateBack() }
        )
    }

    if (showSubmitDialog) {
        SDTSubmitDialog(
            validResponseCount = uiState.validResponseCount,
            totalQuestions = uiState.questions.size,
            onDismiss = { showSubmitDialog = false },
            onConfirm = { showSubmitDialog = false; viewModel.submitTest() }
        )
    }
}

@Composable
private fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator()
            Text(text = stringResource(Res.string.sdt_loading), style = MaterialTheme.typography.bodyMedium)
        }
    }
}
