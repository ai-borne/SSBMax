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
 * The INTERVIEW topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [interviewIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/INTERVIEW.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun interviewIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/INTERVIEW.md#0",
        slug = "what-is-the-personal-interview",
        heading = "What Is the Personal Interview?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("The Personal Interview is conducted one-on-one by the Interviewing Officer (IO), usually spread " +
                "across Day 2 to Day 4 depending on batch size, so that every candidate gets a private 30-45 minute " +
                "session away from the group setting. It is the only stage where an assessor engages with you " +
                "directly and at length, and it is built almost entirely around your PIQ.")
        )
    ),
    DocSection(
        id = "topics/INTERVIEW.md#1",
        slug = "how-is-the-interview-structured",
        heading = "How Is the Interview Structured?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Warm-up**: Background questions -- hometown, schooling, family -- meant to settle nerves and " +
                "establish baseline facts already on your PIQ",
                "**Academic and career background**: Your subjects, performance, and reasoning behind past academic " +
                "or career choices",
                "**Extracurriculars and hobbies**: Deep follow-up on whatever you listed on your PIQ -- expect " +
                "specific, detailed questions on anything you claimed as a genuine interest",
                "**Current affairs and general awareness**: National and international news, defense-related " +
                "developments, and your basic understanding of the service you're applying to",
                "**Situational and opinion-based questions**: Hypothetical scenarios or opinions on social/ethical " +
                "issues, testing how you reason, not just what conclusion you reach",
                "**Motivation questions**: Why the armed forces, why this particular service, and how you'll handle " +
                "the realities of a defense career -- family concerns, remote postings, discipline"
            ))
        )
    ),
    DocSection(
        id = "topics/INTERVIEW.md#2",
        slug = "what-is-the-io-actually-assessing",
        heading = "What Is the IO Actually Assessing?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Consistency**: Do your interview answers match your PIQ and, later, your SD and SRT answers? " +
                "Inconsistency is flagged, not necessarily judged negatively on its own, but it invites deeper " +
                "probing",
                "**Clarity of thought and expression**: Structured, direct answers read far better than long, " +
                "meandering ones, even on difficult questions",
                "**Genuine motivation**: IOs interview thousands of candidates and are trained to distinguish " +
                "rehearsed, generic \"I want to serve the nation\" answers from specific, personally-grounded reasons",
                "**Composure under follow-up**: The IO will often probe a single answer with 2-3 follow-up questions " +
                "-- staying calm and logically consistent under that pressure matters more than the original answer"
            ))
        )
    ),
    DocSection(
        id = "topics/INTERVIEW.md#3",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Know your own PIQ thoroughly -- re-read it the day before and anticipate a follow-up question for " +
                "every single entry",
                "Stay current with national and international news for the weeks leading up to your SSB, especially " +
                "defense-related developments",
                "Practice answering \"why the armed forces\" and \"why this service\" in your own words until it's " +
                "specific and personal, not a memorized line",
                "Practice mock interviews with honest feedback on rambling, filler words, and body language -- " +
                "clarity under a stranger's questioning is a practiced skill, not an innate trait",
                "Prepare a calm, factual explanation for any gap year, academic dip, or repeat attempt in your record"
            ))
        )
    ),
    DocSection(
        id = "topics/INTERVIEW.md#4",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Giving generic, \"textbook patriotic\" answers that don't hold up under a specific follow-up " +
                "question",
                "Contradicting details already written on the PIQ",
                "Overstating hobbies or achievements that can't be discussed in depth when probed",
                "Treating current-affairs questions as a memory test rather than an opportunity to show reasoned " +
                "opinion",
                "Appearing rehearsed or robotic instead of natural and conversational"
            ))
        )
    ),
    DocSection(
        id = "topics/INTERVIEW.md#5",
        slug = "key-points-to-remember",
        heading = "Key Points to Remember",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Be honest and confident rather than trying to guess the \"correct\" answer",
                "Maintain eye contact and a calm, conversational tone throughout",
                "It's acceptable to say \"I don't know\" on a factual question and move on confidently, rather than " +
                "bluffing",
                "The interview is assessed alongside GTO and Psychology results, not in isolation -- consistency " +
                "across all three matters more than any single strong answer"
            ))
        )
    )
    )
)
