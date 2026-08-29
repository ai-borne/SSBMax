package com.ssbmax.shared.ui.content.blocks

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * [toFallbackText]'s pure-function coverage: exercised for every block type in the frozen
 * taxonomy (`scripts/content/blockClassifier.js`'s `TAXONOMY`, `content/SCHEMA.md`), matching
 * the web twin's `toFallbackText` in `blockRegistry.ts` field-by-field. As of Phase 4 only
 * [UnknownBlock] actually renders via this path -- the rich types now have dedicated composables
 * (`BlockRegistryUiTest`) -- but the flattening logic stays tested here since it is still the
 * function a genuinely-unmodelled future block type falls back to.
 */
class BlockRegistryFallbackTest {

    @Test
    fun `specTable flattens as label colon text pairs joined by em dash`() {
        val block = SpecTableBlock(listOf(LabelValue("Duration", "20-30 minutes"), LabelValue("Group Size", "8-10 candidates")))
        assertEquals("Duration: 20-30 minutes — Group Size: 8-10 candidates", toFallbackText(block))
    }

    @Test
    fun `callout flattens as marker colon text`() {
        val block = CalloutBlock("Remember", "GTO wants to see a team player.")
        assertEquals("Remember: GTO wants to see a team player.", toFallbackText(block))
    }

    @Test
    fun `comparison flattens pairs the same way as specTable`() {
        val block = ComparisonBlock(listOf(LabelValue("Wrong", "Courage means bravery."), LabelValue("Right", "I show courage when I speak up.")))
        assertEquals("Wrong: Courage means bravery. — Right: I show courage when I speak up.", toFallbackText(block))
    }

    @Test
    fun `timeline flattens steps the same way as specTable`() {
        val block = TimelineBlock(listOf(LabelValue("9:00 AM", "Reporting"), LabelValue("9:30 AM", "Discussion begins")))
        assertEquals("9:00 AM: Reporting — 9:30 AM: Discussion begins", toFallbackText(block))
    }

    @Test
    fun `table flattens rows pipe-joined and rows semicolon-joined`() {
        val block = TableBlock(listOf(listOf("Week", "Focus"), listOf("1", "Fundamentals")))
        assertEquals("Week | Focus; 1 | Fundamentals", toFallbackText(block))
    }

    @Test
    fun `an unknown future block type flattens via its carried fallbackText and never throws`() {
        val block = UnknownBlock(type = "unknownFutureBlockType", fallbackText = "still readable")
        assertEquals("still readable", toFallbackText(block))
    }

    @Test
    fun `structural types already have real renderers so their fallback text is just their own content`() {
        assertEquals("A plain prose paragraph.", toFallbackText(ParagraphBlock("A plain prose paragraph.")))
        assertEquals("First item • Second item", toFallbackText(ListBlock(listOf("First item", "Second item"))))
        assertEquals("A Subheading", toFallbackText(SubheadingBlock(level = 3, text = "A Subheading")))
    }
}
