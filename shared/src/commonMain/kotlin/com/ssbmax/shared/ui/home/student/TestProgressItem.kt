package com.ssbmax.shared.ui.home.student

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.ui.theme.SSBColors
import com.ssbmax.shared.ui.theme.Spacing
import com.ssbmax.shared.ui.util.formatFullDate
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.cd_test_status_completed
import ssbmax.shared.generated.resources.cd_test_status_in_progress
import ssbmax.shared.generated.resources.cd_test_status_not_attempted
import ssbmax.shared.generated.resources.progress_completed_on
import ssbmax.shared.generated.resources.progress_not_attempted
import ssbmax.shared.generated.resources.progress_result_compiling

/**
 * A single test's progress row inside a [Phase1Card]/[Phase2Card] — split
 * out of `PhaseCards.kt` (same package) purely to stay under this repo's
 * 300-line Quality Limit, no behavior change from the Android original.
 */
@Composable
internal fun TestProgressItem(
    testProgress: TestProgress,
    displayName: String? = null,
    phaseColor: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Status Icon - Checkmark for any completed/attempted test, empty circle for not attempted
        val (icon, iconColor) = when (testProgress.status) {
            TestStatus.COMPLETED, TestStatus.GRADED, TestStatus.SUBMITTED_PENDING_REVIEW ->
                Icons.Default.CheckCircle to SSBColors.Success
            TestStatus.IN_PROGRESS ->
                Icons.Default.Schedule to SSBColors.Warning
            TestStatus.NOT_ATTEMPTED ->
                Icons.Default.RadioButtonUnchecked to MaterialTheme.colorScheme.onSurfaceVariant
        }

        val contentDescription = when (testProgress.status) {
            TestStatus.COMPLETED, TestStatus.GRADED, TestStatus.SUBMITTED_PENDING_REVIEW ->
                stringResource(Res.string.cd_test_status_completed)
            TestStatus.IN_PROGRESS ->
                stringResource(Res.string.cd_test_status_in_progress)
            TestStatus.NOT_ATTEMPTED ->
                stringResource(Res.string.cd_test_status_not_attempted)
        }

        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = iconColor,
            modifier = Modifier.size(Spacing.iconSizeExtraSmall)
        )

        Spacer(modifier = Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                displayName ?: testProgress.testType.displayName,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium
            )

            // Simplified status text - just show "Completed on {date}" or "Not Attempted"
            Text(
                text = when {
                    testProgress.isAnalysisPending ->
                        stringResource(Res.string.progress_result_compiling)
                    testProgress.lastAttemptDate != null -> stringResource(
                        Res.string.progress_completed_on,
                        formatFullDate(testProgress.lastAttemptDate!!)
                    )
                    else -> stringResource(Res.string.progress_not_attempted)
                },
                style = MaterialTheme.typography.labelSmall,
                color = if (testProgress.lastAttemptDate != null) {
                    phaseColor
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}
