package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.parseInlineBold

@Composable
fun SpecTableBlockView(block: SpecTableBlock, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        block.entries.forEach { entry ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(entry.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                Text(parseInlineBold(entry.text), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun SpecTableBlockViewPreview() {
    SpecTableBlockView(
        SpecTableBlock(
            listOf(LabelValue("Duration", "20-30 minutes"), LabelValue("Group Size", "8-10 candidates"))
        )
    )
}
