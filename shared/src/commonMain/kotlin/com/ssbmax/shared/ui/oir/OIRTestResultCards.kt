package com.ssbmax.shared.ui.oir

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh

import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight

import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.CategoryScore
import com.ssbmax.shared.ui.common.progressSemantics
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_result_avg_time
import ssbmax.shared.generated.resources.oir_result_back_home
import ssbmax.shared.generated.resources.oir_result_category_progress
import ssbmax.shared.generated.resources.oir_result_correct_of_total
import ssbmax.shared.generated.resources.oir_result_less_than_one_second
import ssbmax.shared.generated.resources.oir_result_review_answers
import ssbmax.shared.generated.resources.oir_result_take_another_test

/**
 * Further delegate composables for [OIRTestResultScreen] — category
 * performance and action cards. Split out of
 * `OIRTestResultSections.kt` for the same 300-line Quality Limit reason (see
 * [OIRTestResultScreen]'s doc comment).
 */
@Composable
internal fun CategoryPerformanceCard(categoryScore: CategoryScore) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = categoryScore.category.displayName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "${categoryScore.percentage.toInt()}%",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            LinearProgressIndicator(
                progress = { categoryScore.percentage / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .progressSemantics(
                        description = stringResource(
                            Res.string.oir_result_category_progress,
                            categoryScore.percentage.toInt()
                        ),
                        current = categoryScore.percentage,
                        maximum = 100f
                    ),
                color = when {
                    categoryScore.percentage >= 75 -> MaterialTheme.colorScheme.tertiary
                    categoryScore.percentage >= 50 -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.error
                }
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = stringResource(
                        Res.string.oir_result_correct_of_total,
                        categoryScore.correctAnswers,
                        categoryScore.totalQuestions
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = stringResource(
                        Res.string.oir_result_avg_time,
                        categoryScore.averageTimeSeconds.toAverageTimeLabel()
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun Int.toAverageTimeLabel(): String = if (this == 0) {
    stringResource(Res.string.oir_result_less_than_one_second)
} else {
    toString()
}

@Composable
internal fun ActionButtonsCard(
    onTakeAnotherTest: () -> Unit,
    onReviewAnswers: () -> Unit,
    onBackToHome: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onReviewAnswers, modifier = Modifier.fillMaxWidth()) {
                Icon(imageVector = Icons.Default.Visibility, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(Res.string.oir_result_review_answers))
            }
            OutlinedButton(onClick = onTakeAnotherTest, modifier = Modifier.fillMaxWidth()) {
                Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(Res.string.oir_result_take_another_test))
            }
            TextButton(onClick = onBackToHome, modifier = Modifier.fillMaxWidth()) {
                Icon(imageVector = Icons.Default.Home, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(Res.string.oir_result_back_home))
            }
        }
    }
}
