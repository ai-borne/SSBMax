package com.ssbmax.shared.ui.content.blocks

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Renders any [DocBlock] by dispatching on its runtime type. Phase 4 (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) adds the five rich types on top of Phase 2's
 * structural slice. Only [UnknownBlock] (a genuinely-unmodelled future type) still falls back to
 * [toFallbackText] (D1: an unrecognised type is never a hard failure). The web twin is
 * `blockRegistry.ts`; the parity-gate coverage test is `BlockRegistryParityTest.kt`.
 */
@Composable
fun DocBlockView(block: DocBlock, modifier: Modifier = Modifier) {
    when (block) {
        is ParagraphBlock -> ParagraphBlockView(block, modifier)
        is ListBlock -> ListBlockView(block, modifier)
        is SubheadingBlock -> SubheadingBlockView(block, modifier)
        is SpecTableBlock -> SpecTableBlockView(block, modifier)
        is CalloutBlock -> CalloutBlockView(block, modifier)
        is ComparisonBlock -> ComparisonBlockView(block, modifier)
        is TimelineBlock -> TimelineBlockView(block, modifier)
        is TableBlock -> TableBlockView(block, modifier)
        is UnknownBlock -> ParagraphBlockView(ParagraphBlock(toFallbackText(block)), modifier)
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
