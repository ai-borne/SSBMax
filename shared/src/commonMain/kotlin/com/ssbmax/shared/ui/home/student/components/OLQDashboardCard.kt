package com.ssbmax.shared.ui.home.student.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate

import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.usecase.dashboard.ProcessedDashboardData
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.cd_refresh_dashboard
import ssbmax.shared.generated.resources.dashboard_focus_areas
import ssbmax.shared.generated.resources.dashboard_last_updated_now
import ssbmax.shared.generated.resources.dashboard_overall_average
import ssbmax.shared.generated.resources.dashboard_retry
import ssbmax.shared.generated.resources.dashboard_some_unavailable
import ssbmax.shared.generated.resources.dashboard_tests
import ssbmax.shared.generated.resources.dashboard_your_progress
import ssbmax.shared.generated.resources.dashboard_your_strengths

/**
 * OLQ Dashboard Card showing all test results with aggregated scores.
 * Uses pre-computed data for performance (no calculations in UI).
 *
 * @param isLoading true while the initial Firestore fetch is in flight (dashboard == null in
 *                  ViewModel). Shows a LinearProgressIndicator so the card structure is always
 *                  visible without jumping to a different composable. Cleared on success/failure.
 */
@Composable
fun OLQDashboardCard(
    processedData: ProcessedDashboardData,
    onNavigateToResult: (TestType, String) -> Unit = { _, _ -> },
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val dashboard = processedData.dashboard // Extract for convenience

    // Animate refresh icon rotation
    val rotationAngle by animateFloatAsState(
        targetValue = if (isRefreshing) 360f else 0f,
        animationSpec = tween(
            durationMillis = if (isRefreshing) 1000 else 0,
            easing = LinearEasing
        ),
        label = "refresh_rotation"
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header with refresh button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.dashboard_your_progress),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onRefresh,
                        enabled = !isRefreshing,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = stringResource(Res.string.cd_refresh_dashboard),
                            modifier = Modifier.rotate(rotationAngle),
                            tint = if (isRefreshing) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = "${dashboard.completedTestsCount}/${dashboard.totalTests} ${stringResource(Res.string.dashboard_tests)}",
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            // Show LinearProgressIndicator during initial fetch; card structure stays visible.
            // assertDoesNotExist in tests relies on this testTag being absent when isLoading = false.
            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("dashboard_loading_indicator")
                )
            } else {
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Partial-load banner: shown when one or more test types timed out or are still
            // being analyzed (see ProcessedDashboardData.unavailableTypes).
            if (processedData.unavailableTypes.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                UnavailableResultsBanner(onRetry = onRefresh)
            }

            Spacer(modifier = Modifier.height(16.dp))

            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Phase1Section(
                    results = dashboard.phase1Results,
                    onNavigateToResult = onNavigateToResult,
                    isRefreshing = isRefreshing
                )

                PsychologySection(
                    results = dashboard.phase2Results,
                    onNavigateToResult = onNavigateToResult,
                    isRefreshing = isRefreshing
                )

                GTOSection(
                    results = dashboard.phase2Results,
                    onNavigateToResult = onNavigateToResult,
                    isRefreshing = isRefreshing
                )

                InterviewSection(
                    results = dashboard.phase2Results,
                    onNavigateToResult = onNavigateToResult,
                    isRefreshing = isRefreshing
                )
            }

            // Overall average score (pre-computed)
            processedData.overallAverageScore?.let { avgScore ->
                Spacer(modifier = Modifier.height(24.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(Res.string.dashboard_overall_average),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )

                    ScoreBadge(avgScore)
                }
            }

            // Top 3 Strengths (pre-computed)
            if (processedData.topOLQs.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(16.dp))

                OLQStrengthsSection(
                    title = stringResource(Res.string.dashboard_your_strengths),
                    olqs = processedData.topOLQs,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }

            // Areas for Improvement (pre-computed)
            if (processedData.improvementOLQs.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))

                OLQStrengthsSection(
                    title = stringResource(Res.string.dashboard_focus_areas),
                    olqs = processedData.improvementOLQs,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            // Last updated timestamp
            processedData.cacheMetadata.let { metadata ->
                if (!metadata.cacheHit) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = stringResource(Res.string.dashboard_last_updated_now),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/**
 * Banner shown when part of the dashboard couldn't load (a test type timed out or its analysis is
 * still pending). Keeps the rest of the dashboard usable and offers a one-tap retry.
 */
@Composable
private fun UnavailableResultsBanner(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("dashboard_unavailable_banner"),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.errorContainer
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = stringResource(Res.string.dashboard_some_unavailable),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onRetry) {
                Text(stringResource(Res.string.dashboard_retry))
            }
        }
    }
}
