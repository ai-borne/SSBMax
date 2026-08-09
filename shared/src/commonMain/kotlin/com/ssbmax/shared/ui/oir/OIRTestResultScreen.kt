package com.ssbmax.shared.ui.oir

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.presentation.oirresult.OirResultViewModel
import com.ssbmax.shared.ui.common.loadingSemantics
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_result_cd_home
import ssbmax.shared.generated.resources.oir_result_error_title
import ssbmax.shared.generated.resources.oir_result_go_home
import ssbmax.shared.generated.resources.oir_result_loading
import ssbmax.shared.generated.resources.oir_result_performance_by_category
import ssbmax.shared.generated.resources.oir_result_retry
import ssbmax.shared.generated.resources.oir_result_title

/**
 * KMP port of `app/.../ui/tests/oir/OIRTestResultScreen.kt`. Uses the
 * [OirResultViewModel]/`GetOirResultUseCase` path already built in Phase 0's
 * spike (see that ViewModel's own doc comment — it was written back then
 * specifically to be "a near drop-in" for this exact screen port).
 *
 * The Android original hardcoded every user-facing string directly in the
 * Composable (a pre-existing "zero hardcoded strings" lint-rule violation,
 * same class as this phase's other ports) — ported here as real
 * `Res.string.oir_result_*` composeResources entries instead of carrying
 * the violation forward.
 *
 * Split from a single 517-line file into this file (scaffold + loading/error
 * states) plus [OIRTestResultSections.kt] (score/stats cards) and
 * [OIRTestResultCards.kt] (category/action cards) to stay under this repo's
 * 300-line-per-file Quality Limit —
 * same delegate-composable-file precedent as the home vertical's
 * `StudentHomeSections.kt`/`PhaseProgressRibbon.kt`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OIRTestResultScreen(
    submissionId: String,
    onNavigateHome: () -> Unit = {},
    onTakeAnotherTest: () -> Unit = {},
    onReviewAnswers: () -> Unit = {},
    viewModel: OirResultViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(submissionId) {
        viewModel.loadSubmission(submissionId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.oir_result_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateHome) {
                        Icon(
                            imageVector = Icons.Default.Home,
                            contentDescription = stringResource(Res.string.oir_result_cd_home)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> LoadingState(paddingValues)
            uiState.error != null -> ErrorState(
                paddingValues = paddingValues,
                error = uiState.error!!,
                onRetry = { viewModel.retry(submissionId) },
                onNavigateHome = onNavigateHome
            )
            uiState.result != null -> ResultContent(
                result = uiState.result!!,
                paddingValues = paddingValues,
                modifier = modifier,
                onTakeAnotherTest = onTakeAnotherTest,
                onReviewAnswers = onReviewAnswers,
                onNavigateHome = onNavigateHome
            )
        }
    }
}

@Composable
private fun LoadingState(paddingValues: PaddingValues) {
    Box(
        modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .loadingSemantics(stringResource(Res.string.oir_result_loading)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator()
            Text(
                text = stringResource(Res.string.oir_result_loading),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ErrorState(
    paddingValues: PaddingValues,
    error: String,
    onRetry: () -> Unit,
    onNavigateHome: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize().padding(paddingValues).padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Error,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.error
                )
                Text(
                    text = stringResource(Res.string.oir_result_error_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onRetry) {
                        Icon(Icons.Default.Refresh, null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(stringResource(Res.string.oir_result_retry))
                    }
                    Button(onClick = onNavigateHome) {
                        Text(stringResource(Res.string.oir_result_go_home))
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultContent(
    result: OIRTestResult,
    paddingValues: PaddingValues,
    modifier: Modifier,
    onTakeAnotherTest: () -> Unit,
    onReviewAnswers: () -> Unit,
    onNavigateHome: () -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { ScoreHeaderCard(result = result) }
        item { QuickStatsCard(result = result) }
        item {
            Text(
                text = stringResource(Res.string.oir_result_performance_by_category),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }
        items(visibleOIRCategoryScores(result.categoryScores)) { categoryScore ->
            CategoryPerformanceCard(categoryScore = categoryScore)
        }
        item {
            ActionButtonsCard(
                onTakeAnotherTest = onTakeAnotherTest,
                onReviewAnswers = onReviewAnswers,
                onBackToHome = onNavigateHome
            )
        }
    }
}
