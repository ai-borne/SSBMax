package com.ssbmax.shared.ui.interviewresult

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.interviewresult.InterviewResultViewModel
import com.ssbmax.shared.ui.common.loadingSemantics
import com.ssbmax.shared.ui.components.SSBRecommendationBanner
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.interview_button_retry
import ssbmax.shared.generated.resources.interview_cd_close
import ssbmax.shared.generated.resources.interview_error_generic
import ssbmax.shared.generated.resources.interview_result_button_done
import ssbmax.shared.generated.resources.interview_result_olq_scores_title
import ssbmax.shared.generated.resources.interview_result_strengths_title
import ssbmax.shared.generated.resources.interview_result_title
import ssbmax.shared.generated.resources.interview_result_weaknesses_title
import ssbmax.shared.generated.resources.interview_results_analyzing
import ssbmax.shared.generated.resources.interview_results_pending_message
import ssbmax.shared.generated.resources.interview_results_pending_title

/**
 * KMP port of `app/.../ui/interview/result/InterviewResultScreen.kt`.
 *
 * Uses `koinViewModel<InterviewResultViewModel>()` --
 * [InterviewResultViewModel.loadResult] is called from `LaunchedEffect(resultId)`;
 * `InterviewResultViewModel` is a real `androidx.lifecycle.ViewModel`,
 * cancelled automatically in its own `onCleared` (Phase 1 of the
 * KMP-convergence plan). Sub-components (`OverallSummaryCard`/`OLQListCard`/
 * `OLQScoreRow`/`FeedbackCard`) live in `InterviewResultComponents.kt`, same
 * package, split to keep both files under the 300-line Quality Limit.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InterviewResultScreen(
    resultId: String,
    onNavigateBack: () -> Unit,
    viewModel: InterviewResultViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(resultId) { viewModel.loadResult(resultId) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.interview_result_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.Close, stringResource(Res.string.interview_cd_close))
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                uiState.isLoading -> CenteredLoading(uiState.loadingMessage ?: stringResource(Res.string.interview_results_analyzing))
                uiState.isAnalysisPending -> AnalysisPendingContent(onNavigateBack)
                uiState.error != null -> ErrorContent(uiState.error, onRetry = viewModel::refresh)
                uiState.result != null -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        uiState.ssbRecommendation?.let { recommendation ->
                            item { SSBRecommendationBanner(model = recommendation) }
                        }

                        item { OverallSummaryCard(uiState) }

                        if (uiState.strengths.isNotEmpty()) {
                            item {
                                OLQListCard(titleRes = Res.string.interview_result_strengths_title, olqs = uiState.strengths, isPositive = true)
                            }
                        }

                        if (uiState.weaknesses.isNotEmpty()) {
                            item {
                                OLQListCard(titleRes = Res.string.interview_result_weaknesses_title, olqs = uiState.weaknesses, isPositive = false)
                            }
                        }

                        item {
                            Text(text = stringResource(Res.string.interview_result_olq_scores_title), style = MaterialTheme.typography.titleMedium)
                        }

                        items(uiState.getSortedOLQScores()) { (olq, score) ->
                            OLQScoreRow(olqName = olq.displayName, categoryName = olq.category.displayName, score = score.score)
                        }

                        if (uiState.result?.feedback?.isNotBlank() == true) {
                            item { FeedbackCard(uiState.result!!.feedback) }
                        }

                        item {
                            Button(onClick = onNavigateBack, modifier = Modifier.fillMaxWidth()) {
                                Text(stringResource(Res.string.interview_result_button_done))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CenteredLoading(message: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .loadingSemantics(message),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(Modifier.height(16.dp))
        Text(text = message, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun AnalysisPendingContent(onNavigateBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .loadingSemantics(stringResource(Res.string.interview_results_pending_title)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.interview_results_pending_message),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        OutlinedButton(onClick = onNavigateBack) { Text(stringResource(Res.string.interview_result_button_done)) }
    }
}

@Composable
private fun ErrorContent(error: String?, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = error ?: stringResource(Res.string.interview_error_generic),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) { Text(stringResource(Res.string.interview_button_retry)) }
    }
}
