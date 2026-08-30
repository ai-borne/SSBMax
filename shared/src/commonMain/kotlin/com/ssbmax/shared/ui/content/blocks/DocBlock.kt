package com.ssbmax.shared.ui.content.blocks

/**
 * DocumentModel types (docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 2), mirroring
 * `scripts/content/parseDocument.js`'s output shape (see content/SCHEMA.md) and the TypeScript
 * twin at `web/src/components/content/blocks/types.ts`. `type` is a plain string, not a sealed
 * hierarchy alone (D1) -- [Unknown] carries any block type this module doesn't model yet, so a
 * new type from the parser never fails to decode on an older shipped app.
 */
sealed interface DocBlock {
    val type: String
}

data class ParagraphBlock(val text: String) : DocBlock {
    override val type: String = "paragraph"
}

data class ListBlock(val items: List<String>) : DocBlock {
    override val type: String = "list"
}

data class SubheadingBlock(val level: Int, val text: String) : DocBlock {
    override val type: String = "subheading"
}

data class LabelValue(val label: String, val text: String)

data class SpecTableBlock(val entries: List<LabelValue>) : DocBlock {
    override val type: String = "specTable"
}

data class CalloutBlock(val marker: String, val text: String) : DocBlock {
    override val type: String = "callout"
}

data class ComparisonBlock(val pairs: List<LabelValue>) : DocBlock {
    override val type: String = "comparison"
}

data class TimelineBlock(val steps: List<LabelValue>) : DocBlock {
    override val type: String = "timeline"
}

data class TableBlock(val rows: List<List<String>>) : DocBlock {
    override val type: String = "table"
}

/** Any block type not yet modelled above -- the D1 fallback path. [fallbackText] is the
 * best-effort plain-text flattening `blockRegistry.kt` renders it as (mirrors
 * blockRegistry.ts's `toFallbackText`). */
data class UnknownBlock(override val type: String, val fallbackText: String) : DocBlock

data class DocSection(
    val id: String,
    val slug: String,
    val heading: String?,
    val level: Int,
    val blocks: List<DocBlock>,
)

data class DocumentModel(val sections: List<DocSection>)
