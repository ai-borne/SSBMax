package com.ssbmax.shared.ui.content.blocks

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview

@Composable
fun SubheadingBlockView(block: SubheadingBlock, modifier: Modifier = Modifier) {
    val style = when (block.level) {
        1, 2, 3 -> MaterialTheme.typography.titleMedium
        else -> MaterialTheme.typography.titleSmall
    }
    Text(text = block.text, style = style, fontWeight = FontWeight.Bold, modifier = modifier)
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun SubheadingBlockViewPreview() {
    SubheadingBlockView(SubheadingBlock(level = 3, text = "A Subheading"))
}
