package com.ssbmax.shared.ui.ppdt.components.phases

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.ppdt_writing_count_format
import ssbmax.shared.generated.resources.ppdt_writing_hide_keyboard
import ssbmax.shared.generated.resources.ppdt_writing_minimum_label
import ssbmax.shared.generated.resources.ppdt_writing_placeholder
import ssbmax.shared.generated.resources.ppdt_writing_subtitle
import ssbmax.shared.generated.resources.ppdt_writing_title

/**
 * KMP port of `app/.../ui/tests/ppdt/components/phases/PPDTWritingPhase.kt`,
 * unchanged behavior (character-count enforcement, keyboard-inset handling
 * via `imePadding()` -- available in `foundation.layout` on both targets).
 */
@Composable
fun PPDTWritingPhase(
    story: String,
    onStoryChange: (String) -> Unit,
    charactersCount: Int,
    minCharacters: Int,
    maxCharacters: Int
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 16.dp)
            .imePadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(Res.string.ppdt_writing_title),
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(Res.string.ppdt_writing_subtitle),
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { keyboardController?.hide() }) {
                Text(stringResource(Res.string.ppdt_writing_hide_keyboard))
            }
        }

        OutlinedTextField(
            value = story,
            onValueChange = { if (it.length <= maxCharacters) onStoryChange(it) },
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 300.dp),
            placeholder = { Text(stringResource(Res.string.ppdt_writing_placeholder)) },
            maxLines = Int.MAX_VALUE,
            supportingText = {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        text = stringResource(Res.string.ppdt_writing_minimum_label, minCharacters),
                        color = if (charactersCount >= minCharacters) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = stringResource(Res.string.ppdt_writing_count_format, charactersCount, maxCharacters),
                        color = when {
                            charactersCount >= maxCharacters -> MaterialTheme.colorScheme.error
                            charactersCount >= minCharacters -> MaterialTheme.colorScheme.tertiary
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            }
        )

        Spacer(modifier = Modifier.height(8.dp))
    }
}
