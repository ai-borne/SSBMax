package com.ssbmax.shared.ui.oir

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Score
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Surface
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.TestGrade
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_result_correct
import ssbmax.shared.generated.resources.oir_result_incorrect
import ssbmax.shared.generated.resources.oir_result_needs_improvement
import ssbmax.shared.generated.resources.oir_result_passed
import ssbmax.shared.generated.resources.oir_result_quick_stats
import ssbmax.shared.generated.resources.oir_result_raw_score
import ssbmax.shared.generated.resources.oir_result_skipped
import ssbmax.shared.generated.resources.oir_result_time_taken

/**
 * Delegate composables for [OIRTestResultScreen] — score header + quick
 * stats. Split out to keep every file in this vertical under this repo's
 * 300-line-per-file Quality Limit (see [OIRTestResultScreen]'s doc comment
 * for the full split rationale — category/action cards live in
 * `OIRTestResultCards.kt`).
 */
@Composable
internal fun ScoreHeaderCard(result: OIRTestResult) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (result.grade) {
                TestGrade.EXCELLENT, TestGrade.VERY_GOOD -> MaterialTheme.colorScheme.tertiaryContainer
                TestGrade.GOOD -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(text = result.grade.emoji, style = MaterialTheme.typography.displayLarge)
            Text(
                text = result.grade.displayName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "${result.percentageScore.toInt()}",
                    style = MaterialTheme.typography.displayLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "%",
                    style = MaterialTheme.typography.headlineMedium,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            Surface(
                color = if (result.passed) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                shape = MaterialTheme.shapes.small
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (result.passed) Icons.Default.CheckCircle else Icons.Default.Error,
                        contentDescription = null,
                        tint = if (result.passed) MaterialTheme.colorScheme.onTertiary else MaterialTheme.colorScheme.onError
                    )
                    Text(
                        text = stringResource(
                            if (result.passed) Res.string.oir_result_passed else Res.string.oir_result_needs_improvement
                        ),
                        fontWeight = FontWeight.Bold,
                        color = if (result.passed) MaterialTheme.colorScheme.onTertiary else MaterialTheme.colorScheme.onError
                    )
                }
            }
        }
    }
}

@Composable
internal fun QuickStatsCard(result: OIRTestResult) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                text = stringResource(Res.string.oir_result_quick_stats),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                StatItem(
                    icon = Icons.Default.CheckCircle,
                    label = stringResource(Res.string.oir_result_correct),
                    value = result.correctAnswers.toString(),
                    color = MaterialTheme.colorScheme.tertiary
                )
                StatItem(
                    icon = Icons.Default.Cancel,
                    label = stringResource(Res.string.oir_result_incorrect),
                    value = result.incorrectAnswers.toString(),
                    color = MaterialTheme.colorScheme.error
                )
                StatItem(
                    icon = Icons.Default.RadioButtonUnchecked,
                    label = stringResource(Res.string.oir_result_skipped),
                    value = result.skippedQuestions.toString(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            HorizontalDivider()
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                StatItem(
                    icon = Icons.Default.Timer,
                    label = stringResource(Res.string.oir_result_time_taken),
                    value = "${result.timeTakenSeconds / 60}m",
                    color = MaterialTheme.colorScheme.primary
                )
                StatItem(
                    icon = Icons.Default.Score,
                    label = stringResource(Res.string.oir_result_raw_score),
                    value = result.rawScore.toString(),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun StatItem(icon: ImageVector, label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Text(text = value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
