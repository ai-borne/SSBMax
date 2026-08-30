package com.ssbmax.shared.data.repository

import com.ssbmax.shared.ui.content.blocks.CalloutBlock
import com.ssbmax.shared.ui.content.blocks.ComparisonBlock
import com.ssbmax.shared.ui.content.blocks.DocBlock
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import com.ssbmax.shared.ui.content.blocks.LabelValue
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import com.ssbmax.shared.ui.content.blocks.SpecTableBlock
import com.ssbmax.shared.ui.content.blocks.SubheadingBlock
import com.ssbmax.shared.ui.content.blocks.TableBlock
import com.ssbmax.shared.ui.content.blocks.TimelineBlock
import com.ssbmax.shared.ui.content.blocks.UnknownBlock
import kotlinx.serialization.Serializable

/**
 * Wire-format DTOs for the D2 side documents (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md): `topic_sections/{TOPIC}` and
 * `study_material_sections/{id}`, written by `scripts/content/publishContent.js` from the exact
 * same `parseDocument.js` output as `web/src/generated/contentBundle.json`'s `sections` field
 * (see `content/SCHEMA.md`).
 *
 * [DocBlockDto] is one flat, all-nullable-except-[type] shape rather than a sealed/polymorphic
 * hierarchy: `GitLiveStudyContentRepository.kt` decodes via GitLive's own `doc.data(Serializer)`,
 * which offers no hook to register a polymorphic `SerializersModule` (the same constraint D2
 * cites for keeping these as separate documents rather than reusing `topic_content`). A future,
 * unmodelled block type (D1) still decodes -- every field but `type` is optional -- and
 * [toDomain] turns it into an [UnknownBlock] with an empty fallback rather than throwing; a
 * `runCatching` at the repository call site is the real safety net for a decode this DTO can't
 * anticipate at all (see [GitLiveStudyContentRepository.getTopicSections]).
 *
 * `table` blocks are the one shape rewritten in transit: Firestore rejects a directly-nested
 * array (`rows: string[][]`), so `publishContent.js`'s `sanitizeForFirestore` wraps each row as
 * `{ cells: [...] }` before writing -- [TableRowDto] undoes that on the way back out.
 */
@Serializable
internal data class LabelValueDto(
    val label: String = "",
    val text: String = ""
) {
    fun toDomain() = LabelValue(label, text)
}

@Serializable
internal data class TableRowDto(
    val cells: List<String> = emptyList()
)

@Serializable
internal data class DocBlockDto(
    val type: String = "paragraph",
    val text: String? = null,
    val items: List<String>? = null,
    val level: Int? = null,
    val entries: List<LabelValueDto>? = null,
    val marker: String? = null,
    val pairs: List<LabelValueDto>? = null,
    val steps: List<LabelValueDto>? = null,
    val rows: List<TableRowDto>? = null
) {
    fun toDomain(): DocBlock = when (type) {
        "paragraph" -> ParagraphBlock(text.orEmpty())
        "list" -> ListBlock(items.orEmpty())
        "subheading" -> SubheadingBlock(level ?: 2, text.orEmpty())
        "specTable" -> SpecTableBlock(entries.orEmpty().map { it.toDomain() })
        "callout" -> CalloutBlock(marker.orEmpty(), text.orEmpty())
        "comparison" -> ComparisonBlock(pairs.orEmpty().map { it.toDomain() })
        "timeline" -> TimelineBlock(steps.orEmpty().map { it.toDomain() })
        "table" -> TableBlock(rows.orEmpty().map { it.cells })
        else -> UnknownBlock(type, fallbackText = text.orEmpty())
    }
}

@Serializable
internal data class DocSectionDto(
    val id: String = "",
    val slug: String = "",
    val heading: String? = null,
    val level: Int = 0,
    val blocks: List<DocBlockDto> = emptyList()
) {
    fun toDomain() = DocSection(
        id = id,
        slug = slug,
        heading = heading,
        level = level,
        blocks = blocks.map { it.toDomain() }
    )
}

@Serializable
internal data class DocumentModelDto(
    val sections: List<DocSectionDto> = emptyList()
) {
    fun toDomain() = DocumentModel(sections.map { it.toDomain() })
}
