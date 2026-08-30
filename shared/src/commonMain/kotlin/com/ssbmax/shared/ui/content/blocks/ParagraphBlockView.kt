package com.ssbmax.shared.ui.content.blocks

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.ssbmax.shared.ui.common.parseInlineBold

/** Renders [ParagraphBlock], and doubles as the fallback renderer (D1) for any block type
 * `blockRegistry.kt` doesn't otherwise recognise -- see [UnknownBlock]. `text` may still carry
 * inline `**bold**` markers (block-level parsing only strips section/list/table syntax, see
 * content/SCHEMA.md) -- [parseInlineBold] is the same inline parser `MarkdownText` uses, reused
 * here rather than duplicated so both renderers treat `**bold**` identically. */
@Composable
fun ParagraphBlockView(block: ParagraphBlock, modifier: Modifier = Modifier) {
    Text(text = parseInlineBold(block.text), style = MaterialTheme.typography.bodyMedium, modifier = modifier)
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun ParagraphBlockViewPreview() {
    ParagraphBlockView(ParagraphBlock("A plain prose paragraph, the fallback for anything that doesn't fit another type."))
}
