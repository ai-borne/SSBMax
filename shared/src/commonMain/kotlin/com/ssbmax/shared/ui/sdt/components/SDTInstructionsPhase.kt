package com.ssbmax.shared.ui.sdt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_instruction_1
import ssbmax.shared.generated.resources.sdt_instruction_2
import ssbmax.shared.generated.resources.sdt_instruction_3
import ssbmax.shared.generated.resources.sdt_instruction_4
import ssbmax.shared.generated.resources.sdt_instruction_5
import ssbmax.shared.generated.resources.sdt_instruction_6
import ssbmax.shared.generated.resources.sdt_start_test

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestScreen.kt`'s `InstructionsView`.
 * The Android original wraps this in its own `Scaffold` with a top bar; here
 * the top bar is left to [com.ssbmax.shared.ui.sdt.SDTTestScreen] (same
 * inlined-top-bar precedent as TAT/WAT/SRT/PPDT), this composable renders
 * only the scrollable body.
 */
@Composable
fun SDTInstructionsPhase(onStart: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    InstructionItem(stringResource(Res.string.sdt_instruction_1))
                    InstructionItem(stringResource(Res.string.sdt_instruction_2))
                    InstructionItem(stringResource(Res.string.sdt_instruction_3))
                    InstructionItem(stringResource(Res.string.sdt_instruction_4))
                    InstructionItem(stringResource(Res.string.sdt_instruction_5))
                    InstructionItem(stringResource(Res.string.sdt_instruction_6))
                }
            }
        }
        item {
            Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(Res.string.sdt_start_test))
            }
        }
    }
}

@Composable
private fun InstructionItem(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        Text(text)
    }
}
