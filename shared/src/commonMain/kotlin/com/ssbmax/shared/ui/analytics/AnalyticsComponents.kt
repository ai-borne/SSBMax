package com.ssbmax.shared.ui.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics

import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.DifficultyStats
import com.ssbmax.shared.domain.model.PerformanceOverview
import com.ssbmax.shared.domain.model.ProgressionStatus
import com.ssbmax.shared.domain.model.TestTypeStats
import com.ssbmax.shared.ui.theme.semanticColors
import com.ssbmax.shared.ui.util.formatOneDecimal
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.analytics_accuracy_format
import ssbmax.shared.generated.resources.analytics_difficulty_breakdown
import ssbmax.shared.generated.resources.analytics_difficulty_easy
import ssbmax.shared.generated.resources.analytics_difficulty_hard
import ssbmax.shared.generated.resources.analytics_difficulty_medium
import ssbmax.shared.generated.resources.analytics_overall_performance
import ssbmax.shared.generated.resources.analytics_progress_to
import ssbmax.shared.generated.resources.analytics_progression_needed
import ssbmax.shared.generated.resources.analytics_stat_attempts
import ssbmax.shared.generated.resources.analytics_stat_avg_score
import ssbmax.shared.generated.resources.analytics_stat_best
import ssbmax.shared.generated.resources.analytics_stat_study_time
import ssbmax.shared.generated.resources.analytics_stat_tests

/**
 * Sub-composables extracted from `AnalyticsScreen.kt` purely to stay under
 * this repo's 300-line Quality Limit -- the Android original was one 321-line
 * file; this split (overview/stat-item/test-stats/difficulty/progression) is
 * a structural-only change, zero behavior difference, same precedent as this
 * session's other `*Components.kt` splits.
 */
@Composable
internal fun OverviewCard(overview: PerformanceOverview) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(Res.string.analytics_overall_performance),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                StatItem(
                    label = stringResource(Res.string.analytics_stat_tests),
                    value = overview.totalTests.toString(),
                    icon = Icons.Default.CheckCircle
                )
                StatItem(
                    label = stringResource(Res.string.analytics_stat_avg_score),
                    value = "${formatOneDecimal(overview.averageScore)}%",
                    icon = Icons.Default.Star
                )
                StatItem(
                    label = stringResource(Res.string.analytics_stat_study_time),
                    value = "${overview.totalStudyTimeMinutes}m",
                    icon = Icons.Default.DateRange
                )
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String, icon: ImageVector) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(4.dp))
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
internal fun TestStatsCard(stats: TestTypeStats) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    stats.testType,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                DifficultyChip(stats.currentDifficulty)
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(stringResource(Res.string.analytics_stat_attempts), style = MaterialTheme.typography.bodySmall)
                    Text(stats.totalAttempts.toString(), fontWeight = FontWeight.Bold)
                }
                Column {
                    Text(stringResource(Res.string.analytics_stat_avg_score), style = MaterialTheme.typography.bodySmall)
                    Text("${formatOneDecimal(stats.averageScore)}%", fontWeight = FontWeight.Bold)
                }
                Column {
                    Text(stringResource(Res.string.analytics_stat_best), style = MaterialTheme.typography.bodySmall)
                    Text("${formatOneDecimal(stats.bestScore)}%", fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(12.dp))

            DifficultyBreakdown(stats.easyStats, stats.mediumStats, stats.hardStats)

            if (stats.progressionStatus.nextLevel != null) {
                Spacer(Modifier.height(12.dp))
                ProgressionIndicator(stats.progressionStatus)
            }
        }
    }
}

@Composable
private fun DifficultyChip(difficulty: String) {
    val colors = MaterialTheme.semanticColors
    val (color, onColor) = when (difficulty) {
        "EASY" -> colors.success to colors.onSuccess
        "MEDIUM" -> colors.warning to colors.onWarning
        "HARD" -> colors.error to colors.onError
        else -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
    }

    Surface(
        color = color,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            difficulty,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = onColor
        )
    }
}

@Composable
private fun DifficultyBreakdown(
    easy: DifficultyStats,
    medium: DifficultyStats,
    hard: DifficultyStats
) {
    Column {
        Text(stringResource(Res.string.analytics_difficulty_breakdown), style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(8.dp))

        if (easy.attempts > 0) {
            DifficultyRow(stringResource(Res.string.analytics_difficulty_easy), easy.attempts, easy.accuracy)
        }
        if (medium.attempts > 0) {
            DifficultyRow(stringResource(Res.string.analytics_difficulty_medium), medium.attempts, medium.accuracy)
        }
        if (hard.attempts > 0) {
            DifficultyRow(stringResource(Res.string.analytics_difficulty_hard), hard.attempts, hard.accuracy)
        }
    }
}

@Composable
private fun DifficultyRow(label: String, attempts: Int, accuracy: Float) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text("$label ($attempts)", style = MaterialTheme.typography.bodySmall)
        Text(
            stringResource(Res.string.analytics_accuracy_format, formatOneDecimal(accuracy)),
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun ProgressionIndicator(status: ProgressionStatus) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(Res.string.analytics_progress_to, status.nextLevel ?: ""),
                style = MaterialTheme.typography.labelMedium
            )
            Text(
                "${formatOneDecimal(status.progressPercentage)}%",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { status.progressPercentage / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .semantics {
                    progressBarRangeInfo = ProgressBarRangeInfo(
                        current = status.progressPercentage,
                        range = 0f..100f
                    )
                }
        )
        if (!status.canProgress) {
            Spacer(Modifier.height(4.dp))
            Text(
                stringResource(
                    Res.string.analytics_progression_needed,
                    status.attemptsNeeded,
                    formatOneDecimal(status.accuracyNeeded)
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
