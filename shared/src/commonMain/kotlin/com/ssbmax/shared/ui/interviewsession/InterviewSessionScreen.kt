package com.ssbmax.shared.ui.interviewsession

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.interviewsession.InterviewSessionUiState
import com.ssbmax.shared.ui.common.loadingSemantics
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.presentation.interviewsession.InterviewSessionViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.interview_button_cancel
import ssbmax.shared.generated.resources.interview_button_ok
import ssbmax.shared.generated.resources.interview_cd_back
import ssbmax.shared.generated.resources.interview_cd_exit
import ssbmax.shared.generated.resources.interview_cd_mute_tts
import ssbmax.shared.generated.resources.interview_cd_unmute_tts
import ssbmax.shared.generated.resources.interview_error_generic
import ssbmax.shared.generated.resources.interview_exit_confirm
import ssbmax.shared.generated.resources.interview_exit_message
import ssbmax.shared.generated.resources.interview_exit_title
import ssbmax.shared.generated.resources.interview_progress_content_description
import ssbmax.shared.generated.resources.interview_button_retry
import ssbmax.shared.generated.resources.interview_generating_questions
import ssbmax.shared.generated.resources.interview_question_number
import ssbmax.shared.generated.resources.interview_results_pending_message
import ssbmax.shared.generated.resources.interview_results_pending_title

/**
 * KMP port of `app/.../ui/interview/session/InterviewSessionScreen.kt`.
 *
 * Simplified UX preserved verbatim from the Android original: the user
 * types their response or uses the platform keyboard's own voice-to-text
 * (mic button) -- **there is no custom audio recording in this vertical at
 * all** (no `MediaRecorder`/equivalent anywhere in the Android original),
 * which is the key finding for this session's mic/audio-recording
 * investigation: nothing here needed a new platform `expect`/`actual` shim.
 *
 * Uses `koinViewModel<InterviewSessionViewModel>()` --
 * [InterviewSessionViewModel.loadSession] is called once from
 * `LaunchedEffect(sessionId)` instead of reading `SavedStateHandle`;
 * `InterviewSessionViewModel` is a real `androidx.lifecycle.ViewModel`,
 * cancelled automatically in its own `onCleared` (Phase 1 of the
 * KMP-convergence plan) -- `stopAll()` is still called explicitly on the
 * exit paths below, matching the Android original's distinction between
 * "already navigated" and "disposed".
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InterviewSessionScreen(
    sessionId: String,
    onNavigateBack: () -> Unit,
    onNavigateToResult: (String) -> Unit,
    onNavigateToHome: () -> Unit,
    viewModel: InterviewSessionViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var showExitDialog by remember { mutableStateOf(false) }
    var showPendingDialog by remember { mutableStateOf(false) }
    var hasNavigated by remember { mutableStateOf(false) }

    fun safeNavigateBack() {
        if (hasNavigated) return
        hasNavigated = true
        viewModel.stopAll()
        onNavigateBack()
    }

    LaunchedEffect(sessionId) { viewModel.loadSession(sessionId) }

    LaunchedEffect(uiState.isCompleted, uiState.isResultPending) {
        when {
            uiState.isCompleted && uiState.isResultPending -> showPendingDialog = true
            uiState.isCompleted && uiState.resultId != null && !uiState.isResultPending -> {
                if (!hasNavigated) {
                    hasNavigated = true
                    viewModel.stopAll()
                    onNavigateToResult(uiState.resultId!!)
                }
            }
        }
    }

    if (showPendingDialog) {
        AlertDialog(
            onDismissRequest = { /* Can't dismiss - must acknowledge */ },
            title = { Text(stringResource(Res.string.interview_results_pending_title)) },
            text = { Text(text = stringResource(Res.string.interview_results_pending_message), textAlign = TextAlign.Center) },
            confirmButton = {
                Button(onClick = {
                    showPendingDialog = false
                    if (!hasNavigated) {
                        hasNavigated = true
                        viewModel.stopAll()
                        onNavigateToHome()
                    }
                }) { Text(stringResource(Res.string.interview_button_ok)) }
            }
        )
    }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = { Text(stringResource(Res.string.interview_exit_title)) },
            text = { Text(text = stringResource(Res.string.interview_exit_message), textAlign = TextAlign.Center) },
            confirmButton = {
                TextButton(onClick = { showExitDialog = false; safeNavigateBack() }) {
                    Text(stringResource(Res.string.interview_exit_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitDialog = false }) { Text(stringResource(Res.string.interview_button_cancel)) }
            }
        )
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.interview_question_number, uiState.currentQuestionIndex + 1, uiState.totalQuestions)) },
                navigationIcon = {
                    IconButton(onClick = { safeNavigateBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.interview_cd_back))
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.toggleTTSMute() }) {
                        Icon(
                            imageVector = if (uiState.isTTSMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = if (uiState.isTTSMuted) stringResource(Res.string.interview_cd_unmute_tts) else stringResource(Res.string.interview_cd_mute_tts),
                            tint = if (uiState.isTTSMuted) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = {
                        viewModel.stopAll()
                        showExitDialog = true
                    }) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(Res.string.interview_cd_exit), tint = MaterialTheme.colorScheme.error)
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                uiState.isLoading -> LoadingContent(
                    uiState.loadingMessage ?: stringResource(Res.string.interview_generating_questions)
                )
                uiState.error != null -> ErrorContent(
                    error = uiState.error,
                    onRetry = { viewModel.retryLoadSession(sessionId) }
                )
                uiState.currentQuestion != null -> InterviewContent(uiState = uiState, viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun LoadingContent(message: String) = Box(
    Modifier
        .fillMaxSize()
        .loadingSemantics(message),
    contentAlignment = Alignment.Center
) { CircularProgressIndicator() }

@Composable
private fun ErrorContent(error: String?, onRetry: () -> Unit) = Column(
    Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center
) {
    Text(
        text = error ?: stringResource(Res.string.interview_error_generic),
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.error
    )
    Button(onClick = onRetry) { Text(stringResource(Res.string.interview_button_retry)) }
}

@Composable
private fun InterviewContent(uiState: InterviewSessionUiState, viewModel: InterviewSessionViewModel) {
    val progressDescription = stringResource(
        Res.string.interview_progress_content_description,
        uiState.getProgressPercentage().toInt().coerceIn(0, 100)
    )
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        LinearProgressIndicator(
            progress = { uiState.getProgressPercentage() / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .progressSemantics(
                    description = progressDescription,
                    current = uiState.getProgressPercentage().toFloat(),
                    maximum = 100f
                )
        )

        QuestionCard(
            questionText = uiState.currentQuestion!!.questionText,
            isSpeaking = uiState.isTTSSpeaking,
            isMuted = uiState.isTTSMuted
        )

        ResponseInputCard(
            responseText = uiState.responseText,
            onResponseChange = viewModel::updateResponseText,
            enabled = uiState.canEditResponse()
        )

        Spacer(modifier = Modifier.height(8.dp))

        SubmitButton(
            isSubmitting = uiState.isSubmittingResponse,
            canSubmit = uiState.canSubmitResponse(),
            hasMoreQuestions = uiState.hasMoreQuestions(),
            onSubmit = viewModel::submitResponse
        )
    }
}

// QuestionCard/ResponseInputCard/SubmitButton live in InterviewSessionComponents.kt
// (same package, split to stay under the 300-line Quality Limit).
