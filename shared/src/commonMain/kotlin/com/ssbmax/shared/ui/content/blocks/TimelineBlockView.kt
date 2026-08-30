package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.parseInlineBold

@Composable
fun TimelineBlockView(block: TimelineBlock, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        block.steps.forEach { step ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape)
                )
                Column {
                    Text(step.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                    Text(parseInlineBold(step.text), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun TimelineBlockViewPreview() {
    TimelineBlockView(
        TimelineBlock(
            listOf(LabelValue("9:00 AM", "Reporting and briefing"), LabelValue("9:30 AM", "Group discussion begins"))
        )
    )
}
