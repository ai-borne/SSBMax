package com.ssbmax.shared.ui.tat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.backhandler.BackHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TATPhase
import com.ssbmax.shared.presentation.tat.TATTestViewModel
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.TestLimitReachedDialog
import com.ssbmax.shared.ui.tat.components.TATBottomBar
import com.ssbmax.shared.ui.tat.components.TATExitDialog
import com.ssbmax.shared.ui.tat.components.TATProfileRequiredDialog
import com.ssbmax.shared.ui.tat.components.TATSubmitDialog
import com.ssbmax.shared.ui.tat.components.phases.TATImageViewingPhase
import com.ssbmax.shared.ui.tat.components.phases.TATInstructionsPhase
import com.ssbmax.shared.ui.tat.components.phases.TATReviewPhase
import com.ssbmax.shared.ui.tat.components.phases.TATWritingPhase
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.tat_back_cd
import ssbmax.shared.generated.resources.tat_loading
import ssbmax.shared.generated.resources.tat_picture_number
import ssbmax.shared.generated.resources.tat_test_title

/**
 * KMP port of `app/.../ui/tests/tat/TATTestScreen.kt`.
 *
 * Uses `koinViewModel<TATTestViewModel>()`, same as
 * [com.ssbmax.shared.ui.ppdt.PPDTTestScreen] -- `viewModelScope` is cancelled
 * automatically on leaving the screen, no manual `DisposableEffect`/`close()`.
 *
 * Navigation on submit follows the PPDT/OIR precedent: rather than a
 * `Channel<TestNavigationEvent>` (the Android original's
 * `BaseTestViewModel.navigationEvents`, dropped along with the rest of that
 * WorkManager-coupled base class), a `LaunchedEffect(uiState.isSubmitted)`
 * watches the UiState field directly.
 *
 * `TestContentLoadingState`/`TestContentErrorState` (Android-only) are not
 * ported -- inlined here the same way `PPDTTestScreen`/`OIRTestScreen`
 * inline their loading/error states.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun TATTestScreen(
    testId: String,
    onTestComplete: (submissionId: String, subscriptionType: SubscriptionTier) -> Unit = { _, _ -> },
    onNavigateBack: () -> Unit = {},
    viewModel: TATTestViewModel = koinViewModel(),
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

    // Hardware/predictive back must go through the same exit path as the back-arrow icon --
    // otherwise it silently pops the nav stack and leaves the durable test_sessions doc stuck
    // ACTIVE (see PPDTTestScreen's identical fix for the same bug).
    BackHandler(enabled = uiState.questions.isNotEmpty() && !uiState.isSubmitted) {
        showExitDialog = true
    }

    if (uiState.isProfileIncomplete) {
        TATProfileRequiredDialog(onGoToSettings = onNavigateBack, onDismiss = onNavigateBack)
        return
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
            TopAppBar(
                title = {
                    Column {
                        Text(stringResource(Res.string.tat_test_title))
                        if (uiState.currentQuestion != null) {
                            Text(
                                stringResource(Res.string.tat_picture_number, uiState.currentQuestionIndex + 1, uiState.questions.size),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.tat_back_cd))
                    }
                }
            )
        },
        bottomBar = {
            if (uiState.phase != TATPhase.INSTRUCTIONS && uiState.phase != TATPhase.SUBMITTED) {
                TATBottomBar(
                    phase = uiState.phase,
                    canMoveNext = uiState.canMoveToNextQuestion,
                    canSubmit = uiState.canSubmitTest,
                    onNext = { viewModel.moveToNextQuestion() },
                    onSubmit = { showSubmitDialog = true }
                )
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
                else -> Box(modifier = Modifier.fillMaxSize()) {
                    when (uiState.phase) {
                        TATPhase.INSTRUCTIONS -> TATInstructionsPhase(onStart = { viewModel.startTest() })
                        TATPhase.IMAGE_VIEWING -> TATImageViewingPhase(
                            imageUrl = uiState.currentQuestion?.imageUrl ?: "",
                            timeRemaining = uiState.viewingTimeRemaining,
                            sequenceNumber = uiState.currentQuestionIndex + 1
                        )
                        TATPhase.WRITING -> TATWritingPhase(
                            story = uiState.currentStory,
                            onStoryChange = { viewModel.updateStory(it) },
                            timeRemaining = uiState.writingTimeRemaining,
                            minCharacters = uiState.currentQuestion?.minCharacters ?: 150,
                            maxCharacters = uiState.currentQuestion?.maxCharacters ?: 1500,
                            charactersCount = uiState.currentStory.length,
                            sequenceNumber = uiState.currentQuestionIndex + 1
                        )
                        TATPhase.REVIEW -> TATReviewPhase(
                            story = uiState.currentStory,
                            charactersCount = uiState.currentStory.length,
                            sequenceNumber = uiState.currentQuestionIndex + 1,
                            isLastQuestion = uiState.isLastQuestion,
                            onEdit = { viewModel.editCurrentStory() },
                            onConfirm = {
                                if (uiState.isLastQuestion) showSubmitDialog = true else viewModel.confirmCurrentStory()
                            }
                        )
                        TATPhase.SUBMITTED -> Unit // navigation happens in LaunchedEffect above
                    }
                }
            }
        }
    }

    if (showExitDialog) {
        TATExitDialog(
            onDismiss = { showExitDialog = false },
            onExit = { showExitDialog = false; viewModel.pauseTest(); onNavigateBack() }
        )
    }

    if (showSubmitDialog) {
        TATSubmitDialog(
            completedStories = uiState.completedStories,
            totalStories = uiState.questions.size,
            onDismiss = { showSubmitDialog = false },
            onSubmit = { showSubmitDialog = false; viewModel.submitTest() }
        )
    }
}

@Composable
private fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator()
            Text(text = stringResource(Res.string.tat_loading), style = MaterialTheme.typography.bodyMedium)
        }
    }
}
