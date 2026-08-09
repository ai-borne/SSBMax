package com.ssbmax.shared.ui.oir.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_exit_test
import ssbmax.shared.generated.resources.oir_question_format
import ssbmax.shared.generated.resources.oir_timer_content_description

/**
 * KMP port of `app/.../ui/tests/oir/components/OIRTestTopBar.kt`. One real
 * Kotlin/Native gotcha fixed: `String.format("%02d:%02d", minutes, seconds)`
 * (JVM-only, no common `actual`) replaced with manual zero-padding via
 * `toString().padStart(2, '0')` — same gotcha this plan's Phase 2 notes
 * already flagged as recurring (`SSBInterviewPrompts`, a batch-write ID
 * generator, `KtorGeminiResponseParser`'s predecessor).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun OIRTestTopBar(
    questionNumber: Int,
    totalQuestions: Int,
    timeRemainingSeconds: Int,
    onExitClick: () -> Unit
) {
    TopAppBar(
        title = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.oir_question_format, questionNumber, totalQuestions),
                    style = MaterialTheme.typography.titleMedium
                )
                OIRTimerChip(timeRemainingSeconds = timeRemainingSeconds)
            }
        },
        actions = {
            IconButton(onClick = onExitClick) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = stringResource(Res.string.oir_exit_test)
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

/**
 * Countdown timer chip. Turns red when under 5 minutes remain.
 */
@Composable
internal fun OIRTimerChip(timeRemainingSeconds: Int) {
    val minutes = timeRemainingSeconds / 60
    val seconds = timeRemainingSeconds % 60
    val isLowTime = timeRemainingSeconds < 300

    AssistChip(
        onClick = { },
        label = {
            Text(
                text = "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.labelLarge
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Timer,
                contentDescription = stringResource(Res.string.oir_timer_content_description),
                modifier = Modifier.size(18.dp)
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = if (isLowTime) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.tertiaryContainer
            },
            labelColor = if (isLowTime) {
                MaterialTheme.colorScheme.onErrorContainer
            } else {
                MaterialTheme.colorScheme.onTertiaryContainer
            }
        )
    )
}
