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
 * The PSYCHOLOGY topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [psychologyIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/PSYCHOLOGY.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun psychologyIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/PSYCHOLOGY.md#0",
        slug = "what-are-psychology-tests-at-ssb",
        heading = "What Are Psychology Tests at SSB?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Day 2 is dedicated entirely to four written, projective psychology tests -- TAT, WAT, SRT, and SD -- " +
                "administered back to back by the Psychologist in one long sitting. Unlike OIR, there are no right or " +
                "wrong answers here; these tests are designed to surface a candidate's natural thought patterns, " +
                "values, and typical reactions when there isn't time to construct a \"rehearsed\" response.")
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#1",
        slug = "why-do-projective-tests-work",
        heading = "Why Do Projective Tests Work?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Each test gives very little time to think and write, deliberately. With seconds per response rather " +
                "than minutes, most candidates default to their genuine, habitual way of interpreting situations and " +
                "people rather than a curated self-image -- which is exactly what the Psychologist is trying to " +
                "observe. Trying to fake positivity or heroism across dozens of rapid responses is difficult to " +
                "sustain consistently, and inconsistency itself becomes a signal.")
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#2",
        slug = "1-thematic-apperception-test-tat",
        heading = "1. Thematic Apperception Test (TAT)",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "11-12 picture slides (the 12th is a blank slide) shown for 30 seconds each",
                "4 minutes per picture to write a story: what led to the situation, what is happening, and what the " +
                "outcome will be",
                "The blank slide asks you to imagine any picture and write your own story",
                "Assessors look for a consistent, positive, achievement-oriented character across all 11-12 stories " +
                "-- not a single dramatic story, but a stable pattern"
            ))
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#3",
        slug = "2-word-association-test-wat",
        heading = "2. Word Association Test (WAT)",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "60 words shown one at a time for roughly 15 seconds each",
                "Candidates write the very first sentence that comes to mind for each word",
                "With virtually no time to plan, WAT surfaces instinctive associations -- assessors read the pattern " +
                "across all 60 responses, not any single word",
                "Words range from neutral (\"water\", \"book\") to emotionally loaded (\"failure\", \"death\", " +
                "\"fear\") -- reacting constructively to the loaded words matters more than to the neutral ones"
            ))
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#4",
        slug = "3-situation-reaction-test-srt",
        heading = "3. Situation Reaction Test (SRT)",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "60 real-life situations presented in ~30 minutes total (roughly 30 seconds per situation)",
                "Each situation is a short scenario (a conflict, an emergency, an ethical dilemma) requiring a brief " +
                "written reaction describing what you would actually do",
                "Assessors are looking for practical, decisive, socially responsible reactions -- not idealized or " +
                "vague ones (\"I would try my best to help\" says nothing; a concrete first action does)"
            ))
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#5",
        slug = "4-self-description-sd",
        heading = "4. Self Description (SD)",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Five short paragraphs written in about 15 minutes: what your parents think of you, what your " +
                "teachers/employer think of you, what your friends think of you, what you think of yourself, and what " +
                "qualities you'd like to improve",
                "This is the one psychology test candidates fill in with more deliberate thought, and it is directly " +
                "cross-checked against your PIQ, interview answers, and how you actually behaved in GTO tasks"
            ))
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#6",
        slug = "what-are-all-four-tests-really-assessing",
        heading = "What Are All Four Tests Really Assessing?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Across TAT, WAT, SRT, and SD, the Psychologist is triangulating the same 15 OLQs -- particularly " +
                "Effective Intelligence, Determination, Self-Confidence, Social Adaptability, and Sense of " +
                "Responsibility -- by looking for a *stable, positive, action-oriented* pattern repeated dozens of " +
                "times under time pressure, then cross-verifying that pattern against what the GTO and IO " +
                "independently observe.")
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#7",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Practice writing under strict per-item time limits -- the skill being tested is fluent, honest " +
                "expression under pressure, not creativity in isolation",
                "Reflect honestly on your own values and typical reactions beforehand, since genuine self-awareness " +
                "produces more consistent responses than trying to memorize \"ideal\" answers",
                "Favor concrete, specific actions over vague, idealistic statements in SRT and TAT outcomes",
                "Keep your SD answers consistent with how your PIQ and interview responses describe you -- assessors " +
                "actively cross-reference all three"
            ))
        )
    ),
    DocSection(
        id = "topics/PSYCHOLOGY.md#8",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Writing overly dramatic or violent TAT stories, which can read as unresolved negativity rather than " +
                "realism",
                "Leaving WAT or SRT items blank when stuck for time -- an incomplete but honest attempt reads better " +
                "than a large number of skipped items",
                "Giving SD answers that contradict the picture painted elsewhere in your PIQ or interview",
                "Trying to guess \"what the Psychologist wants to hear\" instead of answering genuinely -- " +
                "inconsistency across 60+ rapid responses is very hard to fake convincingly"
            ))
        )
    )
    )
)
