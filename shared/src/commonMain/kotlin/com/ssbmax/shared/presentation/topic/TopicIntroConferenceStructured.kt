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
 * The CONFERENCE topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [conferenceIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/CONFERENCE.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun conferenceIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/CONFERENCE.md#0",
        slug = "what-is-the-conference-final-stage-of-ssb-selection",
        heading = "What Is the Conference: Final Stage of SSB Selection",
        level = 2,
        blocks = listOf(
            ParagraphBlock("The Conference is the culminating event of the 5-day SSB interview process, held on Day 5. This is " +
                "where all assessors come together to make the final decision about your recommendation for " +
                "commissioning into the Indian Armed Forces.")
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#1",
        slug = "who-conducts-the-conference",
        heading = "Who Conducts the Conference?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "President of the Board (presiding officer)",
                "Interviewing Officer (IO)",
                "Group Testing Officer (GTO)",
                "Psychologist",
                "Deputy President (if present)"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#2",
        slug = "what-is-the-conference-procedure",
        heading = "What Is the Conference Procedure?",
        level = 2,
        blocks = listOf(
            SubheadingBlock(level = 3, text = "1. Individual Appearance"),
            ParagraphBlock("Candidates are called one by one into the conference room, arranged in a U-shaped seating with all " +
                "board members present."),
            SubheadingBlock(level = 3, text = "2. Questions You May Face"),
            ListBlock(items = listOf(
                "\"How was your overall SSB experience?\"",
                "\"What did you learn during these 5 days?\"",
                "\"Any suggestions to improve the selection process?\"",
                "\"Clarifications on inconsistencies in your responses\"",
                "\"Why do you want to join the Armed Forces?\" (reconfirmation)",
                "Questions about your PIQ or interview responses"
            )),
            SubheadingBlock(level = 3, text = "3. Assessment Discussion"),
            ParagraphBlock("After you leave, the board discusses:"),
            ListBlock(items = listOf(
                "Your Officer Like Qualities (all 15 OLQs)",
                "Consistency across Psychology, GTO, and Interview",
                "Overall personality assessment",
                "Suitability for armed forces career",
                "Any red flags or outstanding qualities"
            )),
            SubheadingBlock(level = 3, text = "4. Final Decision"),
            ParagraphBlock("The board reaches a consensus through:"),
            ListBlock(items = listOf(
                "Collective evaluation by all assessors",
                "Cross-verification of observations",
                "Holistic view of your 5-day performance",
                "Voting or unanimous decision (varies by center)"
            )),
            SubheadingBlock(level = 3, text = "5. Result Declaration"),
            ParagraphBlock("After all candidates have appeared:"),
            ListBlock(items = listOf(
                "Results are compiled and finalized",
                "All candidates assemble in the conference room",
                "President announces chest numbers of recommended candidates",
                "Detailed discussion may follow for recommended candidates"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#3",
        slug = "what-do-they-assess",
        heading = "What Do They Assess?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Leadership Qualities**: Demonstrated through GTO tasks",
                "**Communication**: Clarity in interview and group discussions",
                "**Consistency**: Between written tests and practical tasks",
                "**Motivation**: Genuine interest in armed forces career",
                "**Personality Traits**: Stability, maturity, composure",
                "**Physical Fitness**: Performance in outdoor tasks",
                "**Social Skills**: Teamwork and cooperation"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#4",
        slug = "key-points-to-remember",
        heading = "Key Points to Remember",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Be Honest**: Provide genuine feedback about the process",
                "**Stay Composed**: Maintain confidence and professionalism",
                "**Be Brief**: Answer questions concisely and clearly",
                "**Show Gratitude**: Thank the board for the opportunity",
                "**Dress Formally**: Wear proper formal attire (shirt, trousers, tie)",
                "**Maintain Eye Contact**: Look at all board members when speaking",
                "**Be Yourself**: Don't try to impress; be natural"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#5",
        slug = "common-questions-to-prepare",
        heading = "Common Questions to Prepare",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Highlights and low points of your SSB experience",
                "What you learned about yourself during these 5 days",
                "Constructive suggestions for improvement",
                "Reconfirmation of your motivations and goals",
                "How you handled challenging tasks"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#6",
        slug = "timeline",
        heading = "Timeline",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Morning: Individual conferences begin (30-45 minutes per candidate)",
                "Afternoon: Board deliberation (candidates wait outside)",
                "Late Afternoon/Evening: Results declaration (typically 4-5 PM)"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#7",
        slug = "important-notes",
        heading = "Important Notes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "The conference is NOT a test; it's a final assessment review",
                "Your fate is mostly decided before the conference",
                "It's an opportunity to clarify any ambiguities",
                "Stay positive regardless of your self-assessment",
                "Some centers may have different procedures"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#8",
        slug = "what-happens-after-results",
        heading = "What Happens After Results?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**If Recommended**: Congratulations! You proceed to medical examination",
                "**If Not Recommended**: Request feedback (some centers provide it)",
                "You can reappear multiple times; many officers succeeded after 2-3 attempts",
                "Learn from the experience and improve for next attempt"
            ))
        )
    ),
    DocSection(
        id = "topics/CONFERENCE.md#9",
        slug = "success-rate",
        heading = "Success Rate",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Approximately 3-5% of screened-in candidates get recommended. The conference ensures only the most " +
                "suitable candidates proceed to commissioning.")
        )
    )
    )
)
