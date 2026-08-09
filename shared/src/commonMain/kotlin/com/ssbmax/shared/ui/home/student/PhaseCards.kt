package com.ssbmax.shared.ui.home.student

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.Phase2Progress

import com.ssbmax.shared.ui.theme.Spacing
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.cd_phase_view_all
import ssbmax.shared.generated.resources.phase_1_label
import ssbmax.shared.generated.resources.phase_1_subtitle
import ssbmax.shared.generated.resources.phase_2_label
import ssbmax.shared.generated.resources.phase_2_subtitle
import ssbmax.shared.generated.resources.progress_gto_tasks
import ssbmax.shared.generated.resources.progress_interview
import ssbmax.shared.generated.resources.progress_no_tests
import ssbmax.shared.generated.resources.progress_psychology_tests
import ssbmax.shared.generated.resources.progress_view_all

/**
 * [Phase1Card]/[Phase2Card]/[TestProgressItem] — split out of
 * `PhaseProgressRibbon.kt` (same package) purely to stay under this repo's
 * 300-line Quality Limit, no behavior change from the Android original.
 */
@Composable
internal fun Phase1Card(
    progress: Phase1Progress?,
    onPhaseClick: () -> Unit,
    onTopicClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val phaseColor = MaterialTheme.colorScheme.primary

    Card(
        modifier = modifier
            .height(Spacing.phaseCardHeight)
            .clickable(onClick = onPhaseClick),
        shape = RoundedCornerShape(Spacing.cardCornerRadius),
        colors = CardDefaults.cardColors(
            containerColor = phaseColor.copy(alpha = 0.05f)
        ),
        border = BorderStroke(
            width = 1.dp,
            color = phaseColor.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(Spacing.medium)
        ) {
            Column {
                Text(
                    stringResource(Res.string.phase_1_label),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = phaseColor
                )
                Text(
                    stringResource(Res.string.phase_1_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(Spacing.large))

            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.small)
            ) {
                if (progress != null) {
                    TestProgressItem(
                        testProgress = progress.oirProgress,
                        phaseColor = phaseColor,
                        onClick = { onTopicClick("oir") }
                    )
                    TestProgressItem(
                        testProgress = progress.ppdtProgress,
                        phaseColor = phaseColor,
                        onClick = { onTopicClick("ppdt") }
                    )
                } else {
                    Text(
                        stringResource(Res.string.progress_no_tests),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            TextButton(
                onClick = onPhaseClick,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.progress_view_all), color = phaseColor)
                Spacer(modifier = Modifier.width(Spacing.extraSmall))
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = stringResource(Res.string.cd_phase_view_all),
                    tint = phaseColor,
                    modifier = Modifier.size(Spacing.iconSizeSmall)
                )
            }
        }
    }
}

@Composable
internal fun Phase2Card(
    progress: Phase2Progress?,
    onPhaseClick: () -> Unit,
    onTopicClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val phaseColor = MaterialTheme.colorScheme.secondary

    Card(
        modifier = modifier
            .height(Spacing.phaseCardHeight)
            .clickable(onClick = onPhaseClick),
        shape = RoundedCornerShape(Spacing.cardCornerRadius),
        colors = CardDefaults.cardColors(
            containerColor = phaseColor.copy(alpha = 0.05f)
        ),
        border = BorderStroke(
            width = 1.dp,
            color = phaseColor.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(Spacing.medium)
        ) {
            Column {
                Text(
                    stringResource(Res.string.phase_2_label),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = phaseColor
                )
                Text(
                    stringResource(Res.string.phase_2_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(Spacing.large))

            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.small)
            ) {
                if (progress != null) {
                    TestProgressItem(
                        testProgress = progress.psychologyProgress,
                        displayName = stringResource(Res.string.progress_psychology_tests),
                        phaseColor = phaseColor,
                        onClick = { onTopicClick("psychology") }
                    )
                    TestProgressItem(
                        testProgress = progress.gtoProgress,
                        displayName = stringResource(Res.string.progress_gto_tasks),
                        phaseColor = phaseColor,
                        onClick = { onTopicClick("gto") }
                    )
                    TestProgressItem(
                        testProgress = progress.interviewProgress,
                        displayName = stringResource(Res.string.progress_interview),
                        phaseColor = phaseColor,
                        onClick = { onTopicClick("interview") }
                    )
                } else {
                    Text(
                        stringResource(Res.string.progress_no_tests),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            TextButton(
                onClick = onPhaseClick,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(Res.string.progress_view_all), color = phaseColor)
                Spacer(modifier = Modifier.width(Spacing.extraSmall))
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = stringResource(Res.string.cd_phase_view_all),
                    tint = phaseColor,
                    modifier = Modifier.size(Spacing.iconSizeSmall)
                )
            }
        }
    }
}

