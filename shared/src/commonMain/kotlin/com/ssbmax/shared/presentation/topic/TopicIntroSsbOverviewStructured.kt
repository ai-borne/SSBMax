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
 * The SSB_OVERVIEW topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [ssbOverviewIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/SSB_OVERVIEW.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun ssbOverviewIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/SSB_OVERVIEW.md#0",
        slug = "what-is-the-ssb-interview",
        heading = "What Is the SSB Interview?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("The Services Selection Board (SSB) is a 5-day, multi-stage assessment used by the Indian Armed " +
                "Forces (Army, Navy, Air Force) to select candidates for commissioned officer roles. Unlike a written " +
                "exam, the SSB is designed to observe how a candidate actually behaves under pressure, in groups, and " +
                "over an extended period -- not just what they know."),
            ParagraphBlock("Every candidate who clears the initial written exam (NDA, CDS, AFCAT, TES, etc.) or applies through " +
                "an entry scheme is called to one of the SSB centers across India (Allahabad, Bhopal, Bangalore, " +
                "Kapurthala, Varanasi, Coimbatore, and others) for this process.")
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#1",
        slug = "why-5-days",
        heading = "Why 5 Days?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("A single interview or test cannot reliably reveal personality traits like leadership, " +
                "decision-making under stress, or teamwork. The SSB deliberately spreads assessment across five days " +
                "and three parallel assessors (Interviewing Officer, Group Testing Officer, Psychologist) so that a " +
                "candidate's true, consistent behavior emerges -- not a rehearsed performance for a single hour.")
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#2",
        slug = "what-is-the-5-day-breakdown",
        heading = "What Is the 5-Day Breakdown?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Day 1 -- Screening**: Officer Intelligence Rating (OIR) tests followed by the Picture Perception & " +
                "Description Test (PPDT). Only candidates who clear screening continue; the rest are sent home the " +
                "same day.",
                "**Day 2 -- Psychology Tests**: Thematic Apperception Test (TAT), Word Association Test (WAT), " +
                "Situation Reaction Test (SRT), and Self Description (SD) -- all projective tests conducted in one " +
                "sitting.",
                "**Day 3 & 4 -- GTO Tasks**: Group Discussion, Group Planning Exercise, Progressive Group Task, Half " +
                "Group Task, Command Task, Individual Obstacles, Final Group Task, and Lecturette, conducted outdoors " +
                "by the Group Testing Officer.",
                "**Day 5 -- Interview & Conference**: Personal interviews (often completed earlier and spread across " +
                "Days 2-4 depending on batch size) conclude, followed by the Conference, where the full board reviews " +
                "every candidate and announces results."
            ))
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#3",
        slug = "what-does-ssb-actually-assess-the-15-officer-like-qualities-olqs",
        heading = "What Does SSB Actually Assess? The 15 Officer Like Qualities (OLQs)",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Every task across all five days maps back to a fixed set of 15 OLQs, grouped into four broad " +
                "categories:"),
            ListBlock(items = listOf(
                "**Planning & Organizing**: Effective Intelligence, Reasoning Ability, Organizing Ability, Power of " +
                "Expression",
                "**Social Adjustment**: Social Adaptability, Cooperation, Sense of Responsibility",
                "**Social Effectiveness**: Initiative, Self-Confidence, Speed of Decision, Ability to Influence the " +
                "Group, Liveliness",
                "**Dynamic**: Determination, Courage, Stamina"
            )),
            ParagraphBlock("Assessors do not score OLQs directly from any single test -- they build a picture from patterns " +
                "repeated across GTO tasks, psychology responses, and the interview, then cross-verify it at the " +
                "Conference.")
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#4",
        slug = "who-assesses-you",
        heading = "Who Assesses You?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Group Testing Officer (GTO)** -- observes outdoor and indoor group tasks",
                "**Psychologist** -- administers and interprets TAT/WAT/SRT/SD",
                "**Interviewing Officer (IO)** -- conducts the one-on-one personal interview",
                "**President/Deputy President** -- chairs the board and the final Conference"
            ))
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#5",
        slug = "what-happens-after-ssb-medical-examination",
        heading = "What Happens After SSB? Medical Examination",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Candidates recommended at the Conference proceed to a medical examination (typically 4-5 days) at a " +
                "nearby military hospital, which checks fitness against Armed Forces medical standards. Only after " +
                "clearing medicals does a candidate's final merit position get confirmed.")
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#6",
        slug = "what-is-the-success-rate-and-what-does-it-mean",
        heading = "What Is the Success Rate and What Does It Mean?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Roughly 10-15% of candidates clear screening on Day 1, and of those, typically 3-5% of the overall " +
                "pool is finally recommended after the Conference. This is not a reflection of raw intelligence or " +
                "fitness alone -- it is a consistency test. Most successful candidates describe SSB preparation as " +
                "less about \"performing\" for five days and more about building genuine habits (structured thinking, " +
                "honest self-expression, teamwork) well before arriving at the center.")
        )
    ),
    DocSection(
        id = "topics/SSB_OVERVIEW.md#7",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Read up on each stage individually (OIR, PPDT, Psychology, GTO, Interview, Conference) using the " +
                "guides linked from this page",
                "Practice sample OIR questions and PPDT story-writing under time pressure",
                "Reflect honestly on your own strengths, weaknesses, and motivations -- psychology tests and the " +
                "interview both probe for consistency, not \"correct\" answers",
                "Stay physically active; GTO's outdoor tasks reward stamina and initiative, not just theoretical " +
                "planning"
            ))
        )
    )
    )
)
