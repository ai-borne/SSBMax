package com.ssbmax.shared.ui.wat.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.wat_important
import ssbmax.shared.generated.resources.wat_important_message
import ssbmax.shared.generated.resources.wat_instruction_1
import ssbmax.shared.generated.resources.wat_instruction_2
import ssbmax.shared.generated.resources.wat_instruction_3
import ssbmax.shared.generated.resources.wat_instruction_4
import ssbmax.shared.generated.resources.wat_instruction_5
import ssbmax.shared.generated.resources.wat_instructions_title
import ssbmax.shared.generated.resources.wat_start_test
import ssbmax.shared.generated.resources.wat_subtitle
import ssbmax.shared.generated.resources.wat_tip_1
import ssbmax.shared.generated.resources.wat_tip_2
import ssbmax.shared.generated.resources.wat_tip_3
import ssbmax.shared.generated.resources.wat_tip_4
import ssbmax.shared.generated.resources.wat_tips_title

/**
 * KMP port of `app/.../ui/tests/wat/components/WATInstructionsView.kt`. The
 * Android original hardcoded every instruction/tip string -- ported here as
 * real composeResources entries, same as TAT/PPDT's instructions phases. The
 * Android original wraps this in its own `Scaffold` with a top bar; here the
 * top bar is left to [com.ssbmax.shared.ui.wat.WATTestScreen] (same
 * inlined-top-bar precedent as TAT/PPDT), this composable renders only the
 * scrollable body.
 */
@Composable
fun WATInstructionsPhase(onStart: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { WATIntroCard() }
        item { WATInstructionsCard() }
        item { WATImportantCard() }
        item { WATTipsCard() }
        item {
            Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.PlayArrow, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(stringResource(Res.string.wat_start_test))
            }
        }
    }
}

@Composable
private fun WATIntroCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(imageVector = Icons.Default.Speed, contentDescription = null, modifier = Modifier.size(32.dp))
            Text(stringResource(Res.string.wat_subtitle), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun WATInstructionsCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(Res.string.wat_instructions_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            InstructionItem(Icons.Default.Numbers, stringResource(Res.string.wat_instruction_1))
            InstructionItem(Icons.Default.Timer, stringResource(Res.string.wat_instruction_2))
            InstructionItem(Icons.Default.Psychology, stringResource(Res.string.wat_instruction_3))
            InstructionItem(Icons.Default.Speed, stringResource(Res.string.wat_instruction_4))
            InstructionItem(Icons.Default.Warning, stringResource(Res.string.wat_instruction_5))
        }
    }
}

@Composable
private fun WATImportantCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.Info, contentDescription = null)
            Column {
                Text(stringResource(Res.string.wat_important), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(stringResource(Res.string.wat_important_message), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun WATTipsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Lightbulb, contentDescription = null)
                Text(stringResource(Res.string.wat_tips_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Text(stringResource(Res.string.wat_tip_1))
            Text(stringResource(Res.string.wat_tip_2))
            Text(stringResource(Res.string.wat_tip_3))
            Text(stringResource(Res.string.wat_tip_4))
        }
    }
}

@Composable
private fun InstructionItem(icon: ImageVector, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
        Text(text = text, style = MaterialTheme.typography.bodyMedium)
    }
}
