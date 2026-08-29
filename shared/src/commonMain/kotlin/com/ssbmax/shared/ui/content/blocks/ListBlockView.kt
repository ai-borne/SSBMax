package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.parseInlineBold

@Composable
fun ListBlockView(block: ListBlock, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        block.items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(text = "•", style = MaterialTheme.typography.bodyMedium)
                Text(text = parseInlineBold(item), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun ListBlockViewPreview() {
    ListBlockView(ListBlock(listOf("First item", "Second item", "Third item")))
}
