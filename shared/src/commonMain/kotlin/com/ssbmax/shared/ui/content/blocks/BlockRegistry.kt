package com.ssbmax.shared.ui.content.blocks

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Renders any [DocBlock] by dispatching on its runtime type. Phase 2 (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) implements the structural blocks only --
 * [SpecTableBlock]/[CalloutBlock]/[ComparisonBlock]/[TimelineBlock]/[TableBlock] land in Phase 4
 * and, like [UnknownBlock], render via [toFallbackText] today (D1: an unrecognised/not-yet-rich
 * type is never a hard failure). The web twin is `blockRegistry.ts`; the parity-gate coverage
 * test is `BlockRegistryParityTest.kt`.
 */
@Composable
fun DocBlockView(block: DocBlock, modifier: Modifier = Modifier) {
    when (block) {
        is ParagraphBlock -> ParagraphBlockView(block, modifier)
        is ListBlock -> ListBlockView(block, modifier)
        is SubheadingBlock -> SubheadingBlockView(block, modifier)
        else -> ParagraphBlockView(ParagraphBlock(toFallbackText(block)), modifier)
    }
}

/** Best-effort plain-text flattening for a block type with no dedicated renderer yet, matching
 * blockRegistry.ts's `toFallbackText` field-by-field so both platforms show the same fallback
 * text for the same block. */
fun toFallbackText(block: DocBlock): String = when (block) {
    is SpecTableBlock -> block.entries.joinToString(" — ") { "${it.label}: ${it.text}" }
    is CalloutBlock -> "${block.marker}: ${block.text}"
    is ComparisonBlock -> block.pairs.joinToString(" — ") { "${it.label}: ${it.text}" }
    is TimelineBlock -> block.steps.joinToString(" — ") { "${it.label}: ${it.text}" }
    is TableBlock -> block.rows.joinToString("; ") { it.joinToString(" | ") }
    is UnknownBlock -> block.fallbackText
    is ParagraphBlock -> block.text
    is ListBlock -> block.items.joinToString(" • ")
    is SubheadingBlock -> block.text
}
