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
 * The PPDT topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [ppdtIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/PPDT.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun ppdtIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/PPDT.md#0",
        slug = "what-is-the-ppdt",
        heading = "What Is the PPDT?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("PPDT is the second half of Day 1 Screening, taken immediately after OIR. Where OIR measures " +
                "reasoning speed, PPDT measures how a candidate perceives an ambiguous situation, constructs a " +
                "plausible story from it, and then defends that story in front of a group -- a preview of the " +
                "group-discussion dynamic that dominates Days 3 and 4.")
        )
    ),
    DocSection(
        id = "topics/PPDT.md#1",
        slug = "what-is-the-four-step-process",
        heading = "What Is the Four-Step Process?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Picture shown -- 30 seconds**: A single, deliberately hazy or ambiguous black-and-white image " +
                "(often showing one or more human figures in an unclear setting) is projected for exactly 30 seconds.",
                "**Individual story -- 4 minutes**: Candidates write a short story covering who the main character " +
                "is, what is happening, what led up to it, and what the outcome will be -- all from a single glance " +
                "at the image.",
                "**Group discussion -- ~15-20 minutes**: Candidates in a group of ~15-20 narrate their individual " +
                "stories one by one, then collectively discuss and agree on a shared story that best fits the " +
                "picture.",
                "**Final narration**: A nominated candidate (or a rotating speaker) presents the group's final agreed " +
                "story to the assessors."
            ))
        )
    ),
    DocSection(
        id = "topics/PPDT.md#2",
        slug = "what-are-assessors-actually-watching",
        heading = "What Are Assessors Actually Watching?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Perception**: Did the story match a genuinely plausible reading of the ambiguous image, or was it " +
                "forced/unrelated?",
                "**Positive, action-oriented thinking**: Stories with a clear character taking constructive action " +
                "are read far more favorably than vague, passive, or negative narratives",
                "**Narration under pressure**: Clarity and confidence while speaking to a group of strangers",
                "**Group behavior**: Whether the candidate listens, builds on others' points, and contributes to " +
                "reaching a shared story -- or dominates, stays silent, or argues without listening"
            ))
        )
    ),
    DocSection(
        id = "topics/PPDT.md#3",
        slug = "how-should-you-structure-your-story-in-4-minutes",
        heading = "How Should You Structure Your Story (in 4 Minutes)?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Characters**: Name your main character (age, gender) within the first line -- don't leave it " +
                "ambiguous",
                "**Mood**: State the mood/emotion clearly before describing action",
                "**Action**: What is the character doing right now, and why",
                "**Outcome**: A short, positive resolution -- avoid tragic, violent, or unresolved endings"
            )),
            ParagraphBlock("A well-structured PPDT story typically runs 60-100 words, written legibly, with a beginning, a clear " +
                "central action, and a resolution -- not a full short story, just enough detail for a reader to " +
                "picture the scene.")
        )
    ),
    DocSection(
        id = "topics/PPDT.md#4",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Overthinking the 30-second image and missing the writing window",
                "Writing a story with no clear character or action (assessors read many stories per batch; vague ones " +
                "are immediately forgettable)",
                "Staying completely silent in the group discussion out of nervousness -- silence is read as low " +
                "initiative, not caution",
                "Trying to \"win\" the group discussion by talking over everyone, which reads as poor cooperation " +
                "rather than leadership"
            ))
        )
    ),
    DocSection(
        id = "topics/PPDT.md#5",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Practice writing structured stories from random, ambiguous images under a strict 4-minute timer",
                "Practice narrating a written story aloud in under 60 seconds, since group narration time is limited " +
                "per person",
                "Join or simulate group discussions to get comfortable speaking early and building on others' points " +
                "rather than repeating your own story",
                "Read a few sample PPDT images and stories to calibrate what \"plausible but positive\" looks like -- " +
                "this is a learnable pattern, not raw creative talent"
            ))
        )
    ),
    DocSection(
        id = "topics/PPDT.md#6",
        slug = "key-numbers-to-remember",
        heading = "Key Numbers to Remember",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Picture viewing time: 30 seconds",
                "Story writing time: 4 minutes",
                "Group size: ~15-20 candidates",
                "Outcome: Combined with OIR to decide Screen In / Screen Out, typically announced the same day"
            ))
        )
    )
    )
)
