package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import com.ssbmax.shared.ui.content.blocks.ListBlock
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock

/**
 * The OIR topic's structured introduction (Phase 2 pilot, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out purely to keep every generated file
 * under the repo's 300-line Quality Limit -- no behavior change from having it inline.
 *
 * GENERATED from content/topics/OIR.md via scripts/content/parseDocument.js -- do not
 * hand-edit. Must stay in lockstep with [oirIntroduction]'s plain-text twin (same source
 * file) until Phase 5 wires real generation for every topic; see ContentFeatureFlags. String
 * literals are word-wrapped across adjacent "..." + "..." concatenations (never an embedded
 * newline) purely to satisfy the repo's MaxLineLength style check -- the resulting string value
 * is identical to the unwrapped source text.
 */
internal fun oirIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
            id = "topics/OIR.md#root",
            slug = "intro",
            heading = null,
            level = 0,
            blocks = listOf(
                ParagraphBlock(
                    "**The Officer Intelligence Rating (OIR) Test**"
                ),
                ParagraphBlock(
                    "OIR is the very first hurdle at SSB, conducted on the morning of Day 1 as part of Screening. It is a " +
                    "pair of timed, objective-type intelligence tests -- Verbal and Non-Verbal -- designed to gauge " +
                    "reasoning ability, one of the 15 Officer Like Qualities, under real time pressure."
                ),
                ParagraphBlock(
                    "**Why It Comes First**"
                ),
                ParagraphBlock(
                    "Screening exists to filter a large intake down to a manageable batch before the resource-intensive " +
                    "GTO/Psychology/Interview stages begin. OIR performance, combined with the PPDT that follows it, " +
                    "decides whether a candidate is \"screened in\" and stays for the remaining four days, or is screened " +
                    "out and sent home the same afternoon."
                ),
                ParagraphBlock(
                    "**Test Structure**"
                ),
                ListBlock(
                    listOf(
                    "**Two booklets**: Verbal (language and number-based reasoning) and Non-Verbal (figure and " +
                    "pattern-based reasoning), taken back to back",
                    "**Duration**: Roughly 30-40 minutes combined, split across the two booklets with a fixed time limit " +
                    "per booklet -- once time is up, that booklet is collected regardless of how many questions remain",
                    "**Question count**: Typically 40-50 questions total across both booklets",
                    "**Format**: Multiple-choice, OMR-sheet based"
                    )
                ),
                ParagraphBlock(
                    "**What Verbal OIR Covers**"
                ),
                ListBlock(
                    listOf(
                    "Analogies and classification (\"odd one out\")",
                    "Series completion (number and letter series)",
                    "Coding-decoding",
                    "Blood relations and direction sense",
                    "Basic arithmetic and number puzzles",
                    "Statement-based logical reasoning"
                    )
                ),
                ParagraphBlock(
                    "**What Non-Verbal OIR Covers**"
                ),
                ListBlock(
                    listOf(
                    "Figure series and pattern completion",
                    "Mirror and water images",
                    "Embedded figures / figure matrices",
                    "Paper folding and cube-based spatial reasoning",
                    "Odd-figure-out among a set of shapes"
                    )
                ),
                ParagraphBlock(
                    "**How It's Actually Evaluated**"
                ),
                ParagraphBlock(
                    "Unlike a school exam, OIR is not scored purely on \"correct answers out of total.\" Assessors also " +
                    "weigh speed (how far into the booklet you got) and consistency across both verbal and non-verbal " +
                    "sections. A candidate who answers fewer questions carefully and mostly correctly is generally read " +
                    "more favorably than one who rushes and guesses widely -- but leaving too many questions unattempted " +
                    "also signals poor time management, which itself maps to the Reasoning Ability and Effective " +
                    "Intelligence OLQs assessors are watching for."
                ),
                ParagraphBlock(
                    "**Common Mistakes**"
                ),
                ListBlock(
                    listOf(
                    "Spending too long on one difficult question and running out of time for easier ones later in the " +
                    "booklet",
                    "Not practicing non-verbal pattern types beforehand -- these are unfamiliar to most candidates coming " +
                    "from a purely academic background and cost the most time on a first attempt",
                    "Ignoring negative-marking rules where they apply at a given center",
                    "Treating OIR as a one-off IQ test rather than a skill that improves measurably with timed practice"
                    )
                ),
                ParagraphBlock(
                    "**How to Prepare**"
                ),
                ListBlock(
                    listOf(
                    "Practice full-length timed sets, not just topic-wise questions -- the time pressure is the actual " +
                    "skill being tested",
                    "Work through non-verbal pattern families (series, mirror/water images, cubes, embedded figures) " +
                    "explicitly, since these rarely appear in general academic preparation",
                    "Track your accuracy-vs-speed trade-off across practice attempts and adjust your pacing rather than " +
                    "always trying to attempt every question",
                    "Review wrong answers to identify whether the error was conceptual (didn't know the rule) or " +
                    "time-pressure-driven (rushed a known concept) -- the fix for each is different"
                    )
                ),
                ParagraphBlock(
                    "**Key Numbers to Remember**"
                ),
                ListBlock(
                    listOf(
                    "Duration: ~30-40 minutes",
                    "Questions: ~40-50 across both booklets",
                    "Difficulty: Moderate to High, weighted toward speed under pressure",
                    "Outcome: Combined with PPDT performance to decide Screen In / Screen Out"
                    )
                )
            )
        )
    )
)
