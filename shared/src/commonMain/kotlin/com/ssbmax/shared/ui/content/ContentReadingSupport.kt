package com.ssbmax.shared.ui.content

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.content.blocks.CalloutBlock
import com.ssbmax.shared.ui.content.blocks.ComparisonBlock
import com.ssbmax.shared.ui.content.blocks.DocBlock
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import com.ssbmax.shared.ui.content.blocks.SpecTableBlock
import com.ssbmax.shared.ui.content.blocks.SubheadingBlock
import com.ssbmax.shared.ui.content.blocks.TableBlock
import com.ssbmax.shared.ui.content.blocks.TimelineBlock
import com.ssbmax.shared.ui.content.blocks.UnknownBlock
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Reading affordances (Phase 7, docs/plans/write-the-phased-plan-wobbly-pancake.md) shared by
 * every [DocSection] renderer: per-section estimated reading time and the "Practice this now"
 * CTA target. Pure functions, no Compose/platform dependency, so both `DocumentView.kt` and any
 * future non-UI caller (e.g. an analytics or prerender pass) can reuse them.
 */
private const val WORDS_PER_MINUTE = 200

/** Word count based estimate, same reading speed assumption as web's `estimateReadingTime.ts`. */
fun estimatedReadingMinutes(section: DocSection): Int {
    val wordCount = section.blocks.sumOf { blockWordCount(it) } + (section.heading?.wordCount() ?: 0)
    return max(1, (wordCount.toDouble() / WORDS_PER_MINUTE).roundToInt())
}

private fun blockWordCount(block: DocBlock): Int = when (block) {
    is ParagraphBlock -> block.text.wordCount()
    is ListBlock -> block.items.sumOf { it.wordCount() }
    is SubheadingBlock -> block.text.wordCount()
    is SpecTableBlock -> block.entries.sumOf { it.label.wordCount() + it.text.wordCount() }
    is CalloutBlock -> block.marker.wordCount() + block.text.wordCount()
    is ComparisonBlock -> block.pairs.sumOf { it.label.wordCount() + it.text.wordCount() }
    is TimelineBlock -> block.steps.sumOf { it.label.wordCount() + it.text.wordCount() }
    is TableBlock -> block.rows.sumOf { row -> row.sumOf { it.wordCount() } }
    is UnknownBlock -> block.fallbackText.wordCount()
}

private fun String.wordCount(): Int = trim().split(Regex("\\s+")).count { it.isNotBlank() }

/**
 * Coarse `topicType` (Firestore `study_materials`' field, e.g. "OIR", "GTO") -> the one
 * unambiguous [TestType] it represents, mirroring web's `topicTypeMapping.ts`
 * (`primaryTestTypeIdForTopicType`). `GTO` and `PSYCHOLOGY` deliberately return null: each
 * covers several [TestType]s and the study-material markdown source carries no per-subtask field
 * to disambiguate further -- same "don't fabricate a single guess" rule the web mapping documents.
 *
 * `when` is exhaustive over [TestType] in the reverse-lookup test
 * (`ContentReadingSupportTest`), so a renamed/added [TestType] member fails that test rather than
 * silently producing a dead "Practice this now" link.
 */
fun testTypeForTopicType(topicType: String): TestType? = when (topicType.uppercase()) {
    "OIR" -> TestType.OIR
    "PPDT" -> TestType.PPDT
    "PIQ_FORM", "PIQ" -> TestType.PIQ
    "INTERVIEW" -> TestType.IO
    "PSYCHOLOGY", "GTO", "CONFERENCE" -> null
    else -> null
}
