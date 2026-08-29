package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.parseInlineBold

/** `rows[0]` is always the header row (content/SCHEMA.md). Wrapped in a horizontal scroll --
 * mirrors TableBlock.tsx's `overflow-x-auto` -- since these tables come from real content and
 * are not guaranteed to fit a narrow phone width. */
@Composable
fun TableBlockView(block: TableBlock, modifier: Modifier = Modifier) {
    val header = block.rows.firstOrNull()
    val body = block.rows.drop(1)
    val columnWidth = 140.dp

    Column(
        modifier = modifier
            .horizontalScroll(rememberScrollState())
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        header?.let { row ->
            Row(modifier = Modifier.background(MaterialTheme.colorScheme.surfaceVariant)) {
                row.forEach { cell ->
                    Text(
                        parseInlineBold(cell),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.width(columnWidth).padding(8.dp)
                    )
                }
            }
        }
        body.forEach { row ->
            Row {
                row.forEach { cell ->
                    Text(
                        parseInlineBold(cell),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.width(columnWidth).padding(8.dp)
                    )
                }
            }
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun TableBlockViewPreview() {
    TableBlockView(TableBlock(listOf(listOf("Week", "Focus"), listOf("1", "Fundamentals"), listOf("2", "Mock tests"))))
}
