package com.ssbmax.shared.ui.components.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.validation.SSBRecommendationUIModel
import com.ssbmax.shared.ui.components.SSBRecommendationBanner
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.result_analysis_failed_description
import ssbmax.shared.generated.resources.result_areas_improvement_title
import ssbmax.shared.generated.resources.result_olq_assessment_title
import ssbmax.shared.generated.resources.result_recommendations_title
import ssbmax.shared.generated.resources.result_top_strengths_title

/**
 * KMP port of `app/.../ui/components/result/UnifiedOLQResultTemplate.kt`,
 * unchanged behavior/layout. PPDT is the first KMP consumer of this
 * cross-test-type template (this session) -- the Android original is shared
 * by PPDT/TAT/WAT/SRT/SDT result screens, so this port is written to serve
 * those future verticals too, not PPDT alone.
 *
 * One structural change from the Android original: the `LazyListScope`
 * section-extension functions in [ResultSections] now take their title
 * string as a parameter instead of resolving `stringResource(R.string...)`
 * internally, because `LazyListScope.item {}`'s lambda receiver isn't
 * `@Composable` the same way a plain function body is in this multiplatform
 * resources API -- resolving the four title strings once here (a real
 * `@Composable` context) and passing them down avoids that mismatch.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T : UnifiedResultUiState> UnifiedOLQResultTemplate(
    uiState: T,
    testTitle: String,
    submissionConfirmationContent: @Composable (T) -> Unit,
    modifier: Modifier = Modifier,
    testSpecificContent: (@Composable (T) -> Unit)? = null,
    submissionStatus: SubmissionStatus? = null,
    showInstructorReview: Boolean = true,
    onNavigateHome: () -> Unit,
    onRetry: (() -> Unit)? = null
) {
    Scaffold(
        topBar = { TopAppBar(title = { Text(testTitle) }) },
        modifier = modifier
    ) { paddingValues ->
        when {
            uiState.isLoading -> LoadingContent(paddingValues = paddingValues)
            uiState.hasError -> ErrorContent(
                errorMessage = uiState.error ?: stringResource(Res.string.result_analysis_failed_description),
                paddingValues = paddingValues,
                onNavigateHome = onNavigateHome
            )
            else -> ResultContent(
                uiState = uiState,
                paddingValues = paddingValues,
                submissionConfirmationContent = submissionConfirmationContent,
                testSpecificContent = testSpecificContent,
                submissionStatus = submissionStatus,
                showInstructorReview = showInstructorReview,
                onNavigateHome = onNavigateHome,
                onRetry = onRetry
            )
        }
    }
}

@Composable
private fun LoadingContent(paddingValues: PaddingValues) {
    Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorContent(errorMessage: String, paddingValues: PaddingValues, onNavigateHome: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { AnalysisFailedCard() }
        item { ResultActionButtons(primaryAction = onNavigateHome) }
    }
}

@Composable
private fun <T : UnifiedResultUiState> ResultContent(
    uiState: T,
    paddingValues: PaddingValues,
    submissionConfirmationContent: @Composable (T) -> Unit,
    testSpecificContent: (@Composable (T) -> Unit)?,
    submissionStatus: SubmissionStatus?,
    showInstructorReview: Boolean,
    onNavigateHome: () -> Unit,
    onRetry: (() -> Unit)?
) {
    val strengthsTitle = stringResource(Res.string.result_top_strengths_title)
    val weaknessesTitle = stringResource(Res.string.result_areas_improvement_title)
    val assessmentTitle = stringResource(Res.string.result_olq_assessment_title)
    val recommendationsTitle = stringResource(Res.string.result_recommendations_title)

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { submissionConfirmationContent(uiState) }

        analysisStatusSection(uiState, onRetry, strengthsTitle, weaknessesTitle, assessmentTitle, recommendationsTitle)

        testSpecificContent?.let { item { it(uiState) } }

        if (showInstructorReview && submissionStatus == SubmissionStatus.SUBMITTED_PENDING_REVIEW) {
            item { InstructorReviewPendingCard() }
        }

        item { ResultActionButtons(primaryAction = onNavigateHome) }
    }
}

private fun <T : UnifiedResultUiState> LazyListScope.analysisStatusSection(
    uiState: T,
    onRetry: (() -> Unit)?,
    strengthsTitle: String,
    weaknessesTitle: String,
    assessmentTitle: String,
    recommendationsTitle: String
) {
    when {
        uiState.isPending -> item { PendingAnalysisCard() }
        uiState.isAnalyzing -> item { AnalyzingCard() }
        // Firestore can expose COMPLETED a few seconds before the separate
        // psych_results document is readable. Keep the user informed instead
        // of leaving an empty result section during that consistency window.
        uiState.isCompleted && !uiState.hasResults -> item { AnalyzingCard() }
        uiState.isFailed -> item { AnalysisFailedCard() }
        uiState.showResults -> olqResultsSection(
            uiState.olqResult!!, uiState.ssbRecommendation,
            strengthsTitle, weaknessesTitle, assessmentTitle, recommendationsTitle
        )
    }
}

private fun LazyListScope.olqResultsSection(
    result: OLQAnalysisResult,
    ssbRecommendation: SSBRecommendationUIModel?,
    strengthsTitle: String,
    weaknessesTitle: String,
    assessmentTitle: String,
    recommendationsTitle: String
) {
    ssbRecommendation?.let { recommendation -> item { SSBRecommendationBanner(model = recommendation) } }
    item { OverallScoreCard(overallScore = result.overallScore, overallRating = result.overallRating, aiConfidence = result.aiConfidence) }
    strengthsSection(result.strengths, strengthsTitle)
    olqCategorySection(result.olqScores, assessmentTitle)
    weaknessesSection(result.weaknesses, weaknessesTitle)
    recommendationsSection(result.recommendations, recommendationsTitle)
}
