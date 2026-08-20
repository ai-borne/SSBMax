package com.ssbmax.shared.ui.sdt

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.ssbmax.shared.ui.common.SsbBackHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.SDTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.sdt.SDTTestUiState
import com.ssbmax.shared.presentation.sdt.SDTTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.common.timerSemantics
import com.ssbmax.shared.ui.sdt.components.SDTExitDialog
import com.ssbmax.shared.ui.sdt.components.SDTInProgressPhase
import com.ssbmax.shared.ui.sdt.components.SDTInProgressState
import com.ssbmax.shared.ui.sdt.components.SDTInstructionsPhase
import com.ssbmax.shared.ui.sdt.components.SDTReviewBottomBar
import com.ssbmax.shared.ui.sdt.components.SDTReviewPhase
import com.ssbmax.shared.ui.sdt.components.SDTSubmitDialog
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_action_exit
import ssbmax.shared.generated.resources.sdt_loading
import ssbmax.shared.generated.resources.sdt_instructions_title
import ssbmax.shared.generated.resources.sdt_question_header
import ssbmax.shared.generated.resources.sdt_review_title
import ssbmax.shared.generated.resources.sdt_timer_content_description

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
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
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

    Scaffold(
        topBar = {
            SDTTopBar(
                phase = uiState.phase,
                questionNumber = uiState.currentQuestionIndex + 1,
                totalQuestions = uiState.questions.size,
                timeRemaining = uiState.totalTimeRemaining,
                onShowExitDialog = { showExitDialog = true }
            )
        },
        bottomBar = {
            if (uiState.phase == SDTPhase.REVIEW) {
                SDTReviewBottomBar(onSubmit = { showSubmitDialog = true })
            }
        },
        modifier = modifier
    ) { paddingValues ->
        SDTScreenBody(
            uiState = uiState,
            paddingValues = paddingValues,
            viewModel = viewModel,
            testId = testId
        )
    }

    SDTScreenDialogs(
        showExitDialog = showExitDialog,
        showSubmitDialog = showSubmitDialog,
        uiState = uiState,
        onDismissExitDialog = { showExitDialog = false },
        onExit = { showExitDialog = false; viewModel.pauseTest(); onNavigateBack() },
        onDismissSubmitDialog = { showSubmitDialog = false },
        onConfirmSubmit = { showSubmitDialog = false; viewModel.submitTest() }
    )
}

/** The Scaffold body content -- extracted so [SDTTestScreen] itself stays within the LOC/complexity limits. */
@Composable
private fun SDTScreenBody(
    uiState: SDTTestUiState,
    paddingValues: PaddingValues,
    viewModel: SDTTestViewModel,
    testId: String
) {
    Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
        when {
            uiState.isLoading -> LoadingState(modifier = Modifier.fillMaxSize())
            uiState.error != null -> TestErrorState(
                error = uiState.error,
                onRetry = { viewModel.loadTest(testId) },
                modifier = Modifier.fillMaxSize()
            )
            else -> SDTPhaseContent(uiState, viewModel)
        }
    }
}

@Composable
private fun SDTPhaseContent(uiState: SDTTestUiState, viewModel: SDTTestViewModel) {
    when (uiState.phase) {
        SDTPhase.INSTRUCTIONS -> SDTInstructionsPhase(onStart = { viewModel.startTest() })
        SDTPhase.IN_PROGRESS -> SDTInProgressPhase(
            state = SDTInProgressState(
                question = uiState.currentQuestion?.question ?: "",
                questionNumber = uiState.currentQuestionIndex + 1,
                totalQuestions = uiState.questions.size,
                answer = uiState.currentAnswer,
                charCount = uiState.currentCharCount,
                minChars = uiState.config?.minCharsPerQuestion ?: 50,
                maxChars = uiState.config?.maxCharsPerQuestion ?: 1500,
                canMoveNext = uiState.canMoveToNext
            ),
            onAnswerChange = { viewModel.updateAnswer(it) },
            onNext = { viewModel.moveToNext() },
            onSkip = { viewModel.skipQuestion() }
        )
        SDTPhase.REVIEW -> SDTReviewPhase(
            questions = uiState.questions,
            responses = uiState.responses,
            onEdit = { index -> viewModel.editQuestion(index) }
        )
        SDTPhase.COMPLETED, SDTPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
    }
}

@Composable
private fun SDTScreenDialogs(
    showExitDialog: Boolean,
    showSubmitDialog: Boolean,
    uiState: SDTTestUiState,
    onDismissExitDialog: () -> Unit,
    onExit: () -> Unit,
    onDismissSubmitDialog: () -> Unit,
    onConfirmSubmit: () -> Unit
) {
    if (showExitDialog) {
        SDTExitDialog(onDismiss = onDismissExitDialog, onExit = onExit)
    }

    if (showSubmitDialog) {
        SDTSubmitDialog(
            validResponseCount = uiState.validResponseCount,
            totalQuestions = uiState.questions.size,
            onDismiss = onDismissSubmitDialog,
            onConfirm = onConfirmSubmit
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

/**
 * Always present, across every [SDTPhase] -- matching TAT/PPDT/WAT/SRT's precedent of a
 * single `Scaffold`-level `TopAppBar` for the whole screen, rather than a top bar
 * duplicated per phase composable. `TopAppBar` applies `WindowInsets.statusBars` by
 * default; the previous per-phase top bars didn't uniformly do that, which let the
 * `INSTRUCTIONS` phase's title card render underneath the status bar/notch (see
 * [com.ssbmax.shared.ui.wat.WATTestScreen]'s identical fix for the same bug class).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SDTTopBar(
    phase: SDTPhase,
    questionNumber: Int,
    totalQuestions: Int,
    timeRemaining: Int,
    onShowExitDialog: () -> Unit
) {
    TopAppBar(
        title = {
            when (phase) {
                SDTPhase.IN_PROGRESS -> Text(stringResource(Res.string.sdt_question_header, questionNumber, totalQuestions))
                SDTPhase.REVIEW -> Text(stringResource(Res.string.sdt_review_title))
                else -> Text(stringResource(Res.string.sdt_instructions_title))
            }
        },
        navigationIcon = {
            IconButton(onClick = onShowExitDialog) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.sdt_action_exit))
            }
        },
        actions = {
            if (phase == SDTPhase.IN_PROGRESS) {
                SDTTimerDisplay(timeRemaining)
            }
        }
    )
}

@Composable
private fun SDTTimerDisplay(timeRemaining: Int) {
    val timerDescription = stringResource(Res.string.sdt_timer_content_description, timeRemaining)
    val minutes = timeRemaining / 60
    val seconds = timeRemaining % 60
    val secondsStr = if (seconds < 10) "0$seconds" else "$seconds"
    val color = when {
        timeRemaining > 300 -> MaterialTheme.colorScheme.primary
        timeRemaining > 60 -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.error
    }
    Text(
        "$minutes:$secondsStr",
        color = color,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .padding(end = 16.dp)
            .timerSemantics(
                description = timerDescription,
                remainingSeconds = timeRemaining,
                totalSeconds = 1800
            )
    )
}
