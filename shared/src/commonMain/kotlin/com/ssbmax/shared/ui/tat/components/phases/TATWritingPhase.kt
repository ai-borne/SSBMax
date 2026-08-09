package com.ssbmax.shared.ui.tat.components.phases

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.tat_blank_slide_reminder_message
import ssbmax.shared.generated.resources.tat_timer_content_description
import ssbmax.shared.generated.resources.tat_blank_slide_reminder_title
import ssbmax.shared.generated.resources.tat_writing_count_format
import ssbmax.shared.generated.resources.tat_writing_placeholder
import ssbmax.shared.generated.resources.tat_writing_supporting_text
import ssbmax.shared.generated.resources.tat_writing_title
import ssbmax.shared.generated.resources.tat_writing_title_blank

/**
 * KMP port of `app/.../ui/tests/tat/components/phases/TATWritingPhase.kt`,
 * unchanged behavior. TAT-specific difference from PPDT's writing phase: a
 * reminder card for the blank card (position 12, imagination-only) and a
 * 240s (4 min) progress bar denominator instead of PPDT's per-question
 * config value.
 */
@Composable
private fun TATWritingHeader(
    sequenceNumber: Int,
    charactersCount: Int,
    maxCharacters: Int,
    minCharacters: Int,
    timeRemaining: Int,
    timerDescription: String
) {
    if (sequenceNumber == 12) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Lightbulb, contentDescription = null)
                    Text(stringResource(Res.string.tat_blank_slide_reminder_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
                Text(stringResource(Res.string.tat_blank_slide_reminder_message), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text(
                    text = stringResource(if (sequenceNumber == 12) Res.string.tat_writing_title_blank else Res.string.tat_writing_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = stringResource(Res.string.tat_writing_count_format, charactersCount, maxCharacters),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (charactersCount < minCharacters || charactersCount > maxCharacters) {
                        MaterialTheme.colorScheme.error
                    } else MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
            Text(
                text = "${timeRemaining / 60}:${(timeRemaining % 60).toString().padStart(2, '0')}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = if (timeRemaining <= 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                modifier = Modifier.timerSemantics(timerDescription, timeRemaining, 240)
            )
        }
    }
}

@Composable
fun TATWritingPhase(
    story: String,
    onStoryChange: (String) -> Unit,
    timeRemaining: Int,
    minCharacters: Int,
    maxCharacters: Int,
    charactersCount: Int,
    sequenceNumber: Int
) {
    val timerDescription = stringResource(Res.string.tat_timer_content_description, timeRemaining)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 16.dp)
            .imePadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        TATWritingHeader(
            sequenceNumber = sequenceNumber,
            charactersCount = charactersCount,
            maxCharacters = maxCharacters,
            minCharacters = minCharacters,
            timeRemaining = timeRemaining,
            timerDescription = timerDescription
        )

        OutlinedTextField(
            value = story,
            onValueChange = { if (it.length <= maxCharacters) onStoryChange(it) },
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 250.dp),
            placeholder = { Text(stringResource(Res.string.tat_writing_placeholder)) },
            supportingText = { Text(stringResource(Res.string.tat_writing_supporting_text)) },
            isError = charactersCount > maxCharacters,
            maxLines = Int.MAX_VALUE
        )

        LinearProgressIndicator(
            progress = { timeRemaining.toFloat() / 240f },
            modifier = Modifier
                .fillMaxWidth()
                .progressSemantics(
                    description = timerDescription,
                    current = timeRemaining.toFloat(),
                    maximum = 240f
                ),
            color = if (timeRemaining < 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(8.dp))
    }
}
