package com.ssbmax.shared.ui.srt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.srt_back_cd
import ssbmax.shared.generated.resources.srt_char_count
import ssbmax.shared.generated.resources.srt_next
import ssbmax.shared.generated.resources.srt_response_placeholder
import ssbmax.shared.generated.resources.srt_progress_content_description
import ssbmax.shared.generated.resources.srt_situation
import ssbmax.shared.generated.resources.srt_timer_content_description
import ssbmax.shared.generated.resources.srt_situation_number
import ssbmax.shared.generated.resources.srt_skip
import ssbmax.shared.generated.resources.srt_your_response

/**
 * KMP port of `app/.../ui/tests/srt/components/SRTInProgressView.kt` and
 * `SRTHeader`. Unlike WAT (one timer per word), SRT has a single whole-test
 * countdown shown here in the header, ticking down across all 60 situations
 * -- [timeRemaining] comes straight from
 * [com.ssbmax.shared.presentation.srt.SRTTestViewModel]'s single test-wide
 * timer, not a per-situation one. The exit-confirmation `AlertDialog` from
 * the Android original is extracted to [SRTExitDialog] (`SRTDialogs.kt`),
 * matching TAT/WAT/PPDT's dialog-extraction precedent; this composable
 * renders only the header + situation + response body.
 */
@Composable
fun SRTInProgressPhase(
    situation: String,
    situationNumber: Int,
    totalSituations: Int,
    timeRemaining: Int,
    response: String,
    onResponseChange: (String) -> Unit,
    minChars: Int,
    maxChars: Int,
    canMoveNext: Boolean,
    onNext: () -> Unit,
    onSkip: () -> Unit,
    onShowExitDialog: () -> Unit
) {
    val backgroundColor = if (timeRemaining <= 60) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surface

    Surface(color = backgroundColor, modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            SRTHeader(situationNumber, totalSituations, timeRemaining, onShowExitDialog)

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .imePadding(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))
                SRTSituationCard(situation = situation)
                SRTResponseInput(
                    response = response,
                    onResponseChange = onResponseChange,
                    minChars = minChars,
                    maxChars = maxChars
                )
                SRTButtons(canMoveNext = canMoveNext, onNext = onNext, onSkip = onSkip)
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SRTHeader(
    situationNumber: Int,
    totalSituations: Int,
    timeRemaining: Int,
    onShowExitDialog: () -> Unit
) {
    val progressDescription = stringResource(
        Res.string.srt_progress_content_description,
        (situationNumber * 100 / totalSituations).coerceIn(0, 100)
    )
    val timerDescription = stringResource(Res.string.srt_timer_content_description, timeRemaining)
    TopAppBar(
        title = {
            Text(
                text = stringResource(Res.string.srt_situation_number, situationNumber, totalSituations),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.progressSemantics(
                    description = progressDescription,
                    current = (situationNumber * 100f / totalSituations).coerceIn(0f, 100f),
                    maximum = 100f
                )
            )
        },
        navigationIcon = {
            IconButton(onClick = onShowExitDialog) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(Res.string.srt_back_cd)
                )
            }
        },
        actions = {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (timeRemaining <= 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier
                    .padding(end = 8.dp)
                    .timerSemantics(
                        description = timerDescription,
                        remainingSeconds = timeRemaining,
                        totalSeconds = 1800
                    )
            ) {
                Text(
                    text = formatSrtTime(timeRemaining),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (timeRemaining <= 60) MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    )
}

private fun formatSrtTime(seconds: Int): String {
    val minutes = seconds / 60
    val remainingSeconds = seconds % 60
    val secondsStr = if (remainingSeconds < 10) "0$remainingSeconds" else "$remainingSeconds"
    return "$minutes:$secondsStr"
}

@Composable
private fun SRTSituationCard(situation: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(Res.string.srt_situation), style = MaterialTheme.typography.titleSmall)
            Text(situation, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun SRTResponseInput(
    response: String,
    onResponseChange: (String) -> Unit,
    minChars: Int,
    maxChars: Int
) {
    OutlinedTextField(
        value = response,
        onValueChange = onResponseChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(stringResource(Res.string.srt_your_response)) },
        placeholder = { Text(stringResource(Res.string.srt_response_placeholder)) },
        supportingText = {
            Text(
                stringResource(Res.string.srt_char_count, response.length, maxChars),
                color = when {
                    response.length < minChars -> MaterialTheme.colorScheme.error
                    response.length > maxChars -> MaterialTheme.colorScheme.error
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        },
        isError = response.length > maxChars,
        maxLines = 8
    )
}

@Composable
private fun SRTButtons(
    canMoveNext: Boolean,
    onNext: () -> Unit,
    onSkip: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        OutlinedButton(onClick = onSkip, modifier = Modifier.weight(1f)) {
            Text(stringResource(Res.string.srt_skip))
        }
        Button(onClick = onNext, enabled = canMoveNext, modifier = Modifier.weight(1f)) {
            Text(stringResource(Res.string.srt_next))
        }
    }
}
