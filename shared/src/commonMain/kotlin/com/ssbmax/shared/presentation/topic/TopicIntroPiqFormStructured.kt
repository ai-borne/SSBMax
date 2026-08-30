package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.ui.content.blocks.CalloutBlock
import com.ssbmax.shared.ui.content.blocks.ComparisonBlock
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import com.ssbmax.shared.ui.content.blocks.LabelValue
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import com.ssbmax.shared.ui.content.blocks.SpecTableBlock
import com.ssbmax.shared.ui.content.blocks.SubheadingBlock
import com.ssbmax.shared.ui.content.blocks.TableBlock
import com.ssbmax.shared.ui.content.blocks.TimelineBlock

/**
 * The PIQ_FORM topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [piqFormIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/PIQ_FORM.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun piqFormIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/PIQ_FORM.md#0",
        slug = "what-is-the-piq-form",
        heading = "What Is the PIQ Form?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("The Personal Information Questionnaire (PIQ) is filled out on Day 1, right after a candidate is " +
                "screened in. It is a detailed biodata form covering family, education, achievements, hobbies, and " +
                "self-assessment questions -- and it becomes the single most important reference document for the " +
                "Interviewing Officer, who builds nearly every interview question directly from it.")
        )
    ),
    DocSection(
        id = "topics/PIQ_FORM.md#1",
        slug = "why-does-the-piq-matter-more-than-most-candidates-expect",
        heading = "Why Does the PIQ Matter More Than Most Candidates Expect?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Many candidates treat the PIQ as routine paperwork. In practice, the IO reads it closely before your " +
                "interview and probes exactly the areas that seem incomplete, inconsistent, or interesting -- a hobby " +
                "listed with no follow-up detail, an achievement with no explanation, a gap year unaccounted for. A " +
                "rushed or generic PIQ produces a harder interview, not an easier one.")
        )
    ),
    DocSection(
        id = "topics/PIQ_FORM.md#2",
        slug = "what-are-the-key-sections",
        heading = "What Are the Key Sections?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Personal & family details**: Name, date of birth, domicile, parents' occupation and education, " +
                "siblings, family income -- filled factually and consistently with any documents you'll carry",
                "**Educational qualifications**: School, board, percentage/CGPA at each stage, along with any " +
                "academic distinctions",
                "**Extracurricular & positions of responsibility**: Sports, NCC/NSS, clubs, leadership roles -- these " +
                "directly feed the \"Organizing Ability\" and \"Initiative\" OLQs the IO is trained to probe",
                "**Hobbies and interests**: A short, honest list -- never padded with hobbies you can't discuss in " +
                "depth",
                "**Self-description questions**: Typically covering your strengths, weaknesses, and reasons for " +
                "choosing a defense career -- written in your own words, not copied phrasing"
            ))
        )
    ),
    DocSection(
        id = "topics/PIQ_FORM.md#3",
        slug = "how-should-you-fill-it-correctly",
        heading = "How Should You Fill It Correctly?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Be factually accurate and internally consistent**: Every number and date on the PIQ should match " +
                "your documents and your SRT/interview answers -- inconsistencies are the single fastest way to " +
                "trigger a probing follow-up",
                "**Write full sentences, not one-word entries**: \"Reading\" as a hobby invites a shallow follow-up; " +
                "\"Reading -- currently reading [specific book/author]\" gives you material to speak confidently " +
                "about",
                "**Don't list what you can't defend**: If you write \"photography\" as a hobby, expect a question " +
                "about camera settings or a recent photograph you took",
                "**Keep the self-description section genuine**: IOs interview thousands of candidates and recognize " +
                "templated, coached answers quickly"
            ))
        )
    ),
    DocSection(
        id = "topics/PIQ_FORM.md#4",
        slug = "how-do-you-prepare-for-the-interview-that-follows",
        heading = "How Do You Prepare for the Interview That Follows?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Re-read your own PIQ the night before your interview as if you were meeting yourself for the first " +
                "time -- note every entry that could invite a \"tell me more\" question",
                "Prepare a short, honest, specific answer for each hobby and achievement listed",
                "Be ready to explain any gap (a year lost to a failed attempt, a change in stream, a break in " +
                "education) calmly and factually",
                "Know your family background details cold -- occupation, rough income bracket, siblings' education -- " +
                "since these come up early and a hesitant answer sets an uneasy tone"
            ))
        )
    ),
    DocSection(
        id = "topics/PIQ_FORM.md#5",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Copying a \"model PIQ\" template found online instead of writing your own factual details",
                "Inflating achievements or positions of responsibility that can't be substantiated with a follow-up " +
                "conversation",
                "Leaving the self-description questions vague or philosophical instead of specific and personal",
                "Filling it in a rush without proofreading dates and numbers against your original documents"
            ))
        )
    )
    )
)
