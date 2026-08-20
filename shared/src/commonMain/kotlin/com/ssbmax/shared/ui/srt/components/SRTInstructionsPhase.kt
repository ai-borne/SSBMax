package com.ssbmax.shared.ui.srt.components

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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Timer
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
import ssbmax.shared.generated.resources.srt_instruction_1
import ssbmax.shared.generated.resources.srt_instruction_2
import ssbmax.shared.generated.resources.srt_instruction_3
import ssbmax.shared.generated.resources.srt_instruction_4
import ssbmax.shared.generated.resources.srt_instructions_title
import ssbmax.shared.generated.resources.srt_start_test
import ssbmax.shared.generated.resources.srt_subtitle
import ssbmax.shared.generated.resources.srt_tip_1
import ssbmax.shared.generated.resources.srt_tip_2
import ssbmax.shared.generated.resources.srt_tip_3
import ssbmax.shared.generated.resources.srt_tip_4
import ssbmax.shared.generated.resources.srt_tip_5
import ssbmax.shared.generated.resources.srt_tips_title

/**
 * KMP port of `app/.../ui/tests/srt/components/SRTInstructionsView.kt`. The
 * Android original wraps this in its own `Scaffold` with a top bar; here the
 * top bar is left to [com.ssbmax.shared.ui.srt.SRTTestScreen] (same
 * inlined-top-bar precedent as TAT/WAT/PPDT), this composable renders only
 * the scrollable body.
 */
@Composable
fun SRTInstructionsPhase(onStart: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { SRTIntroCard() }
        item { SRTInstructionsCard() }
        item { SRTTipsCard() }
        item {
            Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.PlayArrow, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(stringResource(Res.string.srt_start_test))
            }
        }
    }
}

@Composable
private fun SRTIntroCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(imageVector = Icons.Default.Psychology, contentDescription = null, modifier = Modifier.size(32.dp))
            Text(stringResource(Res.string.srt_subtitle), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun SRTInstructionsCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(Res.string.srt_instructions_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            InstructionItem(Icons.Default.FormatListNumbered, stringResource(Res.string.srt_instruction_1))
            InstructionItem(Icons.Default.Edit, stringResource(Res.string.srt_instruction_2))
            InstructionItem(Icons.Default.Timer, stringResource(Res.string.srt_instruction_3))
            InstructionItem(Icons.Default.CheckCircle, stringResource(Res.string.srt_instruction_4))
        }
    }
}

@Composable
private fun SRTTipsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Lightbulb, contentDescription = null)
                Text(stringResource(Res.string.srt_tips_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Text(stringResource(Res.string.srt_tip_1))
            Text(stringResource(Res.string.srt_tip_2))
            Text(stringResource(Res.string.srt_tip_3))
            Text(stringResource(Res.string.srt_tip_4))
            Text(stringResource(Res.string.srt_tip_5))
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
