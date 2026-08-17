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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.srt_char_count
import ssbmax.shared.generated.resources.srt_next
import ssbmax.shared.generated.resources.srt_response_placeholder
import ssbmax.shared.generated.resources.srt_situation
import ssbmax.shared.generated.resources.srt_skip
import ssbmax.shared.generated.resources.srt_your_response

/**
 * KMP port of `app/.../ui/tests/srt/components/SRTInProgressView.kt`'s body
 * (minus its header). The progress/timer header lives in
 * [com.ssbmax.shared.ui.srt.SRTTestScreen]'s single `Scaffold`-level
 * `TopAppBar`, shared across all [com.ssbmax.shared.domain.model.SRTPhase]
 * values (same consolidation as [com.ssbmax.shared.ui.wat.WATTestScreen]) --
 * a per-phase `TopAppBar` duplicated in each phase composable is how the
 * `INSTRUCTIONS` phase ended up with no top bar/status-bar inset at all in
 * the first place, so this composable renders only the situation + response
 * body. The exit-confirmation `AlertDialog` from the Android original is
 * extracted to [SRTExitDialog] (`SRTDialogs.kt`), matching TAT/WAT/PPDT's
 * dialog-extraction precedent.
 */
@Composable
fun SRTInProgressPhase(
    situation: String,
    timeRemaining: Int,
    response: String,
    onResponseChange: (String) -> Unit,
    minChars: Int,
    maxChars: Int,
    canMoveNext: Boolean,
    onNext: () -> Unit,
    onSkip: () -> Unit
) {
    val backgroundColor = if (timeRemaining <= 60) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surface

    Surface(color = backgroundColor, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
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
