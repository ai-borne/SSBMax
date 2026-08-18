package com.ssbmax.shared.ui.wat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
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
import androidx.compose.ui.text.font.FontWeight
import com.ssbmax.shared.ui.common.SsbBackHandler
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.WATPhase
import com.ssbmax.shared.presentation.wat.WATTestUiState
import com.ssbmax.shared.presentation.wat.WATTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.common.timerSemantics
import com.ssbmax.shared.ui.wat.components.WATExitDialog
import com.ssbmax.shared.ui.wat.components.WATInProgressPhase
import com.ssbmax.shared.ui.wat.components.WATInstructionsPhase
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.wat_back_cd
import ssbmax.shared.generated.resources.wat_full_title
import ssbmax.shared.generated.resources.wat_loading
import ssbmax.shared.generated.resources.wat_progress_format
import ssbmax.shared.generated.resources.wat_timer_content_description
import ssbmax.shared.generated.resources.wat_timer_format

/**
 * KMP port of `app/.../ui/tests/wat/WATTestScreen.kt`.
 *
 * Uses `koinViewModel<WATTestViewModel>()`, same as
 * [com.ssbmax.shared.ui.tat.TATTestScreen]/[com.ssbmax.shared.ui.ppdt.PPDTTestScreen] --
 * `viewModelScope` is cancelled automatically on leaving the screen, no
 * manual `DisposableEffect`/`close()`.
 *
 * Navigation on submit follows the same precedent: a
 * `LaunchedEffect(uiState.isSubmitted)` watches the UiState field directly,
 * rather than the Android original's `Channel<TestNavigationEvent>`
 * (`BaseTestViewModel.navigationEvents`, dropped along with the rest of that
 * WorkManager-coupled base class).
 *
 * Simpler than TAT's screen: no bottom bar (WAT has no "next"/"confirm"
 * step -- the response is submitted directly from the in-progress phase),
 * no submit-confirmation dialog (the Android original auto-submits after the
 * last word), and no profile-required gate (WAT's `loadTest` doesn't check
 * gender/profile completeness, unlike TAT).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun WATTestScreen(
    testId: String,
    onTestComplete: (submissionId: String, subscriptionType: SubscriptionTier) -> Unit = { _, _ -> },
    onNavigateBack: () -> Unit = {},
    viewModel: WATTestViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showExitDialog by rememberSaveable { mutableStateOf(false) }

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
    SsbBackHandler(enabled = uiState.words.isNotEmpty() && !uiState.isSubmitted) {
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
            WATTopBar(
                phase = uiState.phase,
                wordNumber = uiState.currentWordIndex + 1,
                totalWords = uiState.words.size,
                timeRemaining = uiState.timeRemaining,
                onShowExitDialog = { showExitDialog = true }
            )
        },
        modifier = modifier
    ) { paddingValues ->
        WATScreenBody(uiState = uiState, paddingValues = paddingValues, viewModel = viewModel, testId = testId)
    }

    if (showExitDialog) {
        WATExitDialog(
            onDismiss = { showExitDialog = false },
            onExit = { showExitDialog = false; viewModel.pauseTest(); onNavigateBack() }
        )
    }
}

/** The Scaffold body content -- extracted so [WATTestScreen] itself stays under the complexity limit. */
@Composable
private fun WATScreenBody(
    uiState: WATTestUiState,
    paddingValues: PaddingValues,
    viewModel: WATTestViewModel,
    testId: String
) {
    Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
        when {
            uiState.isLoading -> LoadingState(modifier = Modifier.fillMaxSize())
            uiState.error != null -> TestErrorState(
                error = uiState.error!!,
                onRetry = { viewModel.loadTest(testId) },
                modifier = Modifier.fillMaxSize()
            )
            else -> WATPhaseContent(uiState, viewModel)
        }
    }
}

@Composable
private fun WATPhaseContent(uiState: WATTestUiState, viewModel: WATTestViewModel) {
    when (uiState.phase) {
        WATPhase.INSTRUCTIONS -> WATInstructionsPhase(onStart = { viewModel.startTest() })
        WATPhase.IN_PROGRESS -> WATInProgressPhase(
            word = uiState.currentWord?.word ?: "",
            timeRemaining = uiState.timeRemaining,
            response = uiState.currentResponse,
            onResponseChange = { viewModel.updateResponse(it) },
            onSubmit = { viewModel.submitResponse() },
            onSkip = { viewModel.skipWord() }
        )
        WATPhase.COMPLETED -> Unit // auto-submits; brief transitional state
        WATPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
    }
}

@Composable
private fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator()
            Text(text = stringResource(Res.string.wat_loading), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/**
 * Always present, across every [WATPhase] -- matching TAT/PPDT's precedent of a single
 * `Scaffold`-level `TopAppBar` for the whole screen, rather than WAT's previous per-phase
 * header drawn inside a plain `Row`. `TopAppBar` applies `WindowInsets.statusBars` by
 * default; the plain `Row` it replaces didn't, which let the header and the instructions
 * title card render underneath the status bar/notch.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WATTopBar(
    phase: WATPhase,
    wordNumber: Int,
    totalWords: Int,
    timeRemaining: Int,
    onShowExitDialog: () -> Unit
) {
    TopAppBar(
        title = {
            if (phase == WATPhase.IN_PROGRESS) {
                Text(
                    stringResource(Res.string.wat_progress_format, wordNumber, totalWords),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Text(stringResource(Res.string.wat_full_title), style = MaterialTheme.typography.titleMedium)
            }
        },
        navigationIcon = {
            IconButton(onClick = onShowExitDialog) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.wat_back_cd))
            }
        },
        actions = {
            if (phase == WATPhase.IN_PROGRESS) {
                val timerDescription = stringResource(Res.string.wat_timer_content_description, timeRemaining)
                Card(
                    modifier = Modifier
                        .padding(end = 16.dp)
                        .timerSemantics(
                            description = timerDescription,
                            remainingSeconds = timeRemaining,
                            totalSeconds = 15
                        ),
                    colors = CardDefaults.cardColors(
                        containerColor = if (timeRemaining <= 5) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(
                        stringResource(Res.string.wat_timer_format, timeRemaining),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    )
}
