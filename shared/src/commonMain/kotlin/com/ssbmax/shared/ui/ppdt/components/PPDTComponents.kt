package com.ssbmax.shared.ui.ppdt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Timer

import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.ppdt_exit_cd
import ssbmax.shared.generated.resources.ppdt_progress_content_description
import ssbmax.shared.generated.resources.ppdt_review_button
import ssbmax.shared.generated.resources.ppdt_timer_content_description
import ssbmax.shared.generated.resources.ppdt_submit_button
import ssbmax.shared.generated.resources.ppdt_topbar_title

/**
 * KMP port of `app/.../ui/tests/ppdt/components/PPDTComponents.kt`.
 *
 * Kotlin/Native gotcha fixed: `String.format("%02d:%02d", minutes, seconds)`
 * (`String.format` has no common `actual`, hit repeatedly across this
 * migration) replaced with `toString().padStart(2, '0')`, the same fix
 * already applied to `OIRTestTopBar`'s `TimerChip`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PPDTTopBar(
    currentPhase: PPDTPhase,
    timeRemainingSeconds: Int,
    onExitClick: () -> Unit
) {
    TopAppBar(
        title = {
            Column {
                Text(text = stringResource(Res.string.ppdt_topbar_title), style = MaterialTheme.typography.titleMedium)
                Text(text = currentPhase.displayName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        actions = {
            if (currentPhase == PPDTPhase.IMAGE_VIEWING || currentPhase == PPDTPhase.WRITING) {
                TimerChip(timeRemainingSeconds = timeRemainingSeconds)
                Spacer(modifier = Modifier.width(8.dp))
            }
            IconButton(onClick = onExitClick) {
                Icon(imageVector = Icons.Default.Close, contentDescription = stringResource(Res.string.ppdt_exit_cd))
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

@Composable
fun TimerChip(timeRemainingSeconds: Int) {
    val timerDescription = stringResource(Res.string.ppdt_timer_content_description, timeRemainingSeconds)
    val minutes = timeRemainingSeconds / 60
    val seconds = timeRemainingSeconds % 60
    val isLowTime = timeRemainingSeconds < 30

    Surface(
        modifier = Modifier.timerSemantics(
            description = timerDescription,
            remainingSeconds = timeRemainingSeconds,
            totalSeconds = 30
        ),
        shape = MaterialTheme.shapes.small,
        color = if (isLowTime) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = if (isLowTime) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onTertiaryContainer
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(imageVector = Icons.Default.Timer, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(
                text = "${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}",
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun PPDTBottomBar(
    currentPhase: PPDTPhase,
    canProceed: Boolean,
    onNext: () -> Unit,
    onSubmit: () -> Unit
) {
    Surface(tonalElevation = 3.dp) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.End) {
            when (currentPhase) {
                PPDTPhase.WRITING -> {
                    Button(onClick = onNext, enabled = canProceed) {
                        Text(stringResource(Res.string.ppdt_review_button))
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                }
                PPDTPhase.REVIEW -> {
                    Button(onClick = onSubmit, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary)) {
                        Icon(imageVector = Icons.Default.Done, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(stringResource(Res.string.ppdt_submit_button))
                    }
                }
                else -> Unit // IMAGE_VIEWING auto-proceeds; INSTRUCTIONS/SUBMITTED show no bottom bar
            }
        }
    }
}
