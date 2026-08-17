package com.ssbmax.shared.ui.srt

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import com.ssbmax.shared.ui.common.SsbBackHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.SRTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.srt.SRTTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import com.ssbmax.shared.ui.srt.components.SRTExitDialog
import com.ssbmax.shared.ui.srt.components.SRTInProgressPhase
import com.ssbmax.shared.ui.srt.components.SRTInstructionsPhase
import com.ssbmax.shared.ui.srt.components.SRTReviewBottomBar
import com.ssbmax.shared.ui.srt.components.SRTReviewPhase
import com.ssbmax.shared.ui.srt.components.SRTSubmitDialog
import com.ssbmax.shared.ui.srt.components.SRTTimeUpDialog
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.srt_back_cd
import ssbmax.shared.generated.resources.srt_full_title
import ssbmax.shared.generated.resources.srt_loading
import ssbmax.shared.generated.resources.srt_progress_content_description
import ssbmax.shared.generated.resources.srt_review_title
import ssbmax.shared.generated.resources.srt_situation_number
import ssbmax.shared.generated.resources.srt_timer_content_description

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
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
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

    Scaffold(
        topBar = {
            SRTTopBar(
                phase = uiState.phase,
                situationNumber = uiState.currentSituationIndex + 1,
                totalSituations = uiState.situations.size,
                timeRemaining = uiState.timeRemaining,
                onShowExitDialog = { showExitDialog = true }
            )
        },
        bottomBar = {
            if (uiState.phase == SRTPhase.REVIEW) {
                SRTReviewBottomBar(onSubmit = { showSubmitDialog = true })
            }
        },
        modifier = modifier
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
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
                        timeRemaining = uiState.timeRemaining,
                        response = uiState.currentResponse,
                        onResponseChange = { viewModel.updateResponse(it) },
                        minChars = uiState.config?.minResponseLength ?: 0,
                        maxChars = uiState.config?.maxResponseLength ?: 200,
                        canMoveNext = uiState.canMoveToNext,
                        onNext = { viewModel.moveToNext() },
                        onSkip = { viewModel.skipSituation() }
                    )
                    SRTPhase.REVIEW -> SRTReviewPhase(
                        responses = uiState.responses,
                        totalSituations = uiState.situations.size,
                        onEdit = { index -> viewModel.editResponse(index) }
                    )
                    SRTPhase.COMPLETED, SRTPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
                }
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

/**
 * Always present, across every [SRTPhase] -- matching TAT/PPDT/WAT's precedent of a single
 * `Scaffold`-level `TopAppBar` for the whole screen, rather than a header duplicated per
 * phase composable. `TopAppBar` applies `WindowInsets.statusBars` by default; the previous
 * per-phase headers didn't uniformly do that, which let the `INSTRUCTIONS` phase's title
 * card render underneath the status bar/notch (see [com.ssbmax.shared.ui.wat.WATTestScreen]'s
 * identical fix for the same bug class).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SRTTopBar(
    phase: SRTPhase,
    situationNumber: Int,
    totalSituations: Int,
    timeRemaining: Int,
    onShowExitDialog: () -> Unit
) {
    TopAppBar(
        title = {
            when (phase) {
                SRTPhase.IN_PROGRESS -> {
                    val progressDescription = stringResource(
                        Res.string.srt_progress_content_description,
                        (situationNumber * 100 / totalSituations.coerceAtLeast(1)).coerceIn(0, 100)
                    )
                    Text(
                        text = stringResource(Res.string.srt_situation_number, situationNumber, totalSituations),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.progressSemantics(
                            description = progressDescription,
                            current = (situationNumber * 100f / totalSituations.coerceAtLeast(1)).coerceIn(0f, 100f),
                            maximum = 100f
                        )
                    )
                }
                SRTPhase.REVIEW -> Text(stringResource(Res.string.srt_review_title), style = MaterialTheme.typography.titleMedium)
                else -> Text(stringResource(Res.string.srt_full_title), style = MaterialTheme.typography.titleMedium)
            }
        },
        navigationIcon = {
            IconButton(onClick = onShowExitDialog) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.srt_back_cd))
            }
        },
        actions = {
            if (phase == SRTPhase.IN_PROGRESS) {
                val timerDescription = stringResource(Res.string.srt_timer_content_description, timeRemaining)
                val containerColor = if (timeRemaining <= 60) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.primaryContainer
                }
                Card(
                    colors = CardDefaults.cardColors(containerColor = containerColor),
                    modifier = Modifier
                        .padding(end = 8.dp)
                        .timerSemantics(
                            description = timerDescription,
                            remainingSeconds = timeRemaining,
                            totalSeconds = 1800
                        )
                ) {
                    Text(
                        text = formatSrtTime(timeRemaining),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (timeRemaining <= 60) MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    )
}

private fun formatSrtTime(seconds: Int): String {
    val minutes = seconds / 60
    val remainingSeconds = seconds % 60
    val secondsStr = if (remainingSeconds < 10) "0$remainingSeconds" else "$remainingSeconds"
    return "$minutes:$secondsStr"
}
