package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.background
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

/** Covers Wrong/Right, Myth N/Reality, and Problem/Solution pairs (content/SCHEMA.md) -- mirrors
 * ComparisonBlock.tsx's red/green split by the same label-prefix heuristic. */
private fun isNegativeLabel(label: String) = Regex("^(wrong|myth|problem|negative)", RegexOption.IGNORE_CASE).containsMatchIn(label)

@Composable
fun ComparisonBlockView(block: ComparisonBlock, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        block.pairs.forEach { pair ->
            val negative = isNegativeLabel(pair.label)
            val containerColor = if (negative) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer
            val contentColor = if (negative) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(containerColor, RoundedCornerShape(8.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "${if (negative) "✗" else "✓"} ${pair.label}:",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = contentColor
                )
                Text(parseInlineBold(pair.text), style = MaterialTheme.typography.bodyMedium, color = contentColor)
            }
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun ComparisonBlockViewPreview() {
    ComparisonBlockView(
        ComparisonBlock(
            listOf(
                LabelValue("Wrong", "Courage means bravery in danger."),
                LabelValue("Right", "I show courage when I speak up even if my view is unpopular.")
            )
        )
    )
}
