package com.ssbmax.shared.data.repository

import com.ssbmax.shared.ui.content.blocks.CalloutBlock
import com.ssbmax.shared.ui.content.blocks.ComparisonBlock
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import com.ssbmax.shared.ui.content.blocks.SpecTableBlock
import com.ssbmax.shared.ui.content.blocks.SubheadingBlock
import com.ssbmax.shared.ui.content.blocks.TableBlock
import com.ssbmax.shared.ui.content.blocks.TimelineBlock
import com.ssbmax.shared.ui.content.blocks.UnknownBlock
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * DTO<->domain mapping tests for the D2 side documents (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), same testable-internal-DTO convention as
 * StudyContentDtoTest. Decodes real JSON (not just constructs DTOs directly) for the block
 * taxonomy, matching the exact shape `scripts/content/publishContent.js` writes -- including its
 * `sanitizeForFirestore` table-row wrapping, which is the one shape rewritten in transit
 * (Firestore rejects a directly-nested array).
 */
class StudyContentSectionsDtoTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun decodeModel(sectionsJson: String): DocumentModelDto =
        json.decodeFromString(DocumentModelDto.serializer(), """{"sections": $sectionsJson}""")

    @Test
    fun `paragraph block decodes to ParagraphBlock`() {
        val model = decodeModel("""[{"id":"s#0","slug":"intro","heading":null,"level":0,"blocks":[{"type":"paragraph","text":"Hello"}]}]""")

        assertEquals(ParagraphBlock("Hello"), model.toDomain().sections[0].blocks[0])
    }

    @Test
    fun `list block decodes to ListBlock`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[{"type":"list","items":["one","two"]}]}]"""
        )

        assertEquals(ListBlock(listOf("one", "two")), model.toDomain().sections[0].blocks[0])
    }

    @Test
    fun `subheading block decodes to SubheadingBlock`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[{"type":"subheading","level":3,"text":"Sub"}]}]"""
        )

        assertEquals(SubheadingBlock(3, "Sub"), model.toDomain().sections[0].blocks[0])
    }

    @Test
    fun `specTable block decodes to SpecTableBlock with ordered entries`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[
                {"type":"specTable","entries":[{"label":"Duration","text":"20 min"},{"label":"Size","text":"8-10"}]}
            ]}]"""
        )

        val block = model.toDomain().sections[0].blocks[0] as SpecTableBlock
        assertEquals(listOf("Duration" to "20 min", "Size" to "8-10"), block.entries.map { it.label to it.text })
    }

    @Test
    fun `callout block decodes to CalloutBlock`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[{"type":"callout","marker":"Remember","text":"Stay calm"}]}]"""
        )

        assertEquals(CalloutBlock("Remember", "Stay calm"), model.toDomain().sections[0].blocks[0])
    }

    @Test
    fun `comparison block decodes to ComparisonBlock`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[
                {"type":"comparison","pairs":[{"label":"Wrong","text":"X"},{"label":"Right","text":"Y"}]}
            ]}]"""
        )

        val block = model.toDomain().sections[0].blocks[0] as ComparisonBlock
        assertEquals(listOf("Wrong" to "X", "Right" to "Y"), block.pairs.map { it.label to it.text })
    }

    @Test
    fun `timeline block decodes to TimelineBlock`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[
                {"type":"timeline","steps":[{"label":"9:00 AM","text":"Reporting"}]}
            ]}]"""
        )

        val block = model.toDomain().sections[0].blocks[0] as TimelineBlock
        assertEquals(listOf("9:00 AM" to "Reporting"), block.steps.map { it.label to it.text })
    }

    @Test
    fun `table block decodes the sanitizeForFirestore cells-wrapped shape back into rows`() {
        // publishContent.js's sanitizeForFirestore wraps every row as { cells } because
        // Firestore rejects a directly-nested array -- this is the one shape rewritten in
        // transit; this test proves the DTO undoes exactly that wrapping.
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[
                {"type":"table","rows":[{"cells":["H1","H2"]},{"cells":["a","b"]}]}
            ]}]"""
        )

        val block = model.toDomain().sections[0].blocks[0] as TableBlock
        assertEquals(listOf(listOf("H1", "H2"), listOf("a", "b")), block.rows)
    }

    @Test
    fun `an unrecognised block type decodes to UnknownBlock rather than throwing (D1)`() {
        val model = decodeModel(
            """[{"id":"s#0","slug":"a","heading":null,"level":0,"blocks":[{"type":"futureBlockType","text":"whatever"}]}]"""
        )

        assertEquals(UnknownBlock("futureBlockType", "whatever"), model.toDomain().sections[0].blocks[0])
    }

    @Test
    fun `a section's structural fields all map to domain`() {
        val model = decodeModel(
            """[{"id":"topics/OIR.md#0","slug":"why-it-comes-first","heading":"Why It Comes First","level":2,"blocks":[]}]"""
        )

        val section = model.toDomain().sections[0]
        assertEquals("topics/OIR.md#0", section.id)
        assertEquals("why-it-comes-first", section.slug)
        assertEquals("Why It Comes First", section.heading)
        assertEquals(2, section.level)
    }
}
