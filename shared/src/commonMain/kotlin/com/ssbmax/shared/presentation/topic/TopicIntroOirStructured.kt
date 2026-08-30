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
 * The OIR topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [oirIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/OIR.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun oirIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/OIR.md#0",
        slug = "what-is-the-oir-test",
        heading = "What Is the OIR Test?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("OIR is the very first hurdle at SSB, conducted on the morning of Day 1 as part of Screening. It is a " +
                "pair of timed, objective-type intelligence tests -- Verbal and Non-Verbal -- designed to gauge " +
                "reasoning ability, one of the 15 Officer Like Qualities, under real time pressure.")
        )
    ),
    DocSection(
        id = "topics/OIR.md#1",
        slug = "why-does-it-come-first",
        heading = "Why Does It Come First?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Screening exists to filter a large intake down to a manageable batch before the resource-intensive " +
                "GTO/Psychology/Interview stages begin. OIR performance, combined with the PPDT that follows it, " +
                "decides whether a candidate is \"screened in\" and stays for the remaining four days, or is screened " +
                "out and sent home the same afternoon.")
        )
    ),
    DocSection(
        id = "topics/OIR.md#2",
        slug = "what-is-the-test-structure",
        heading = "What Is the Test Structure?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Two booklets**: Verbal (language and number-based reasoning) and Non-Verbal (figure and " +
                "pattern-based reasoning), taken back to back",
                "**Duration**: Roughly 30-40 minutes combined, split across the two booklets with a fixed time limit " +
                "per booklet -- once time is up, that booklet is collected regardless of how many questions remain",
                "**Question count**: Typically 40-50 questions total across both booklets",
                "**Format**: Multiple-choice, OMR-sheet based"
            ))
        )
    ),
    DocSection(
        id = "topics/OIR.md#3",
        slug = "what-does-verbal-oir-cover",
        heading = "What Does Verbal OIR Cover?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Analogies and classification (\"odd one out\")",
                "Series completion (number and letter series)",
                "Coding-decoding",
                "Blood relations and direction sense",
                "Basic arithmetic and number puzzles",
                "Statement-based logical reasoning"
            ))
        )
    ),
    DocSection(
        id = "topics/OIR.md#4",
        slug = "what-does-non-verbal-oir-cover",
        heading = "What Does Non-Verbal OIR Cover?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Figure series and pattern completion",
                "Mirror and water images",
                "Embedded figures / figure matrices",
                "Paper folding and cube-based spatial reasoning",
                "Odd-figure-out among a set of shapes"
            ))
        )
    ),
    DocSection(
        id = "topics/OIR.md#5",
        slug = "how-is-it-actually-evaluated",
        heading = "How Is It Actually Evaluated?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Unlike a school exam, OIR is not scored purely on \"correct answers out of total.\" Assessors also " +
                "weigh speed (how far into the booklet you got) and consistency across both verbal and non-verbal " +
                "sections. A candidate who answers fewer questions carefully and mostly correctly is generally read " +
                "more favorably than one who rushes and guesses widely -- but leaving too many questions unattempted " +
                "also signals poor time management, which itself maps to the Reasoning Ability and Effective " +
                "Intelligence OLQs assessors are watching for.")
        )
    ),
    DocSection(
        id = "topics/OIR.md#6",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Spending too long on one difficult question and running out of time for easier ones later in the " +
                "booklet",
                "Not practicing non-verbal pattern types beforehand -- these are unfamiliar to most candidates coming " +
                "from a purely academic background and cost the most time on a first attempt",
                "Ignoring negative-marking rules where they apply at a given center",
                "Treating OIR as a one-off IQ test rather than a skill that improves measurably with timed practice"
            ))
        )
    ),
    DocSection(
        id = "topics/OIR.md#7",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Practice full-length timed sets, not just topic-wise questions -- the time pressure is the actual " +
                "skill being tested",
                "Work through non-verbal pattern families (series, mirror/water images, cubes, embedded figures) " +
                "explicitly, since these rarely appear in general academic preparation",
                "Track your accuracy-vs-speed trade-off across practice attempts and adjust your pacing rather than " +
                "always trying to attempt every question",
                "Review wrong answers to identify whether the error was conceptual (didn't know the rule) or " +
                "time-pressure-driven (rushed a known concept) -- the fix for each is different"
            ))
        )
    ),
    DocSection(
        id = "topics/OIR.md#8",
        slug = "key-numbers-to-remember",
        heading = "Key Numbers to Remember",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Duration: ~30-40 minutes",
                "Questions: ~40-50 across both booklets",
                "Difficulty: Moderate to High, weighted toward speed under pressure",
                "Outcome: Combined with PPDT performance to decide Screen In / Screen Out"
            ))
        )
    )
    )
)
