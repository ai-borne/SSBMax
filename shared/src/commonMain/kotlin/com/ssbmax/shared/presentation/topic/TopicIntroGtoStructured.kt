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
 * The GTO topic's structured offline-fallback [DocumentModel] (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), split out of [TopicContentLoader] purely to keep
 * every generated file under the repo's 300-line Quality Limit -- no behavior change from
 * having it inline. Must stay in lockstep with [gtoIntroduction]'s plain-text twin
 * (same source file).
 *
 * GENERATED from content/topics/GTO.md via scripts/content/parseDocument.js -- do not
 * hand-edit.
 */
internal fun gtoIntroductionSections(): DocumentModel = DocumentModel(
    sections = listOf(
        DocSection(
        id = "topics/GTO.md#0",
        slug = "what-are-gto-tasks",
        heading = "What Are GTO Tasks?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Days 3 and 4 belong entirely to the Group Testing Officer, who runs a series of indoor and outdoor " +
                "group exercises designed to observe leadership, planning, and physical execution in a way no written " +
                "test can. This is typically the most physically demanding and time-intensive stage of SSB.")
        )
    ),
    DocSection(
        id = "topics/GTO.md#1",
        slug = "why-does-gto-exist-as-a-separate-stage",
        heading = "Why Does GTO Exist as a Separate Stage?",
        level = 2,
        blocks = listOf(
            ParagraphBlock("Psychology tests reveal how you think when writing alone; the interview reveals how you present " +
                "yourself one-on-one. GTO is the only stage where the board watches you operate inside a real group, " +
                "under real physical and time constraints, competing and cooperating with the same 8-10 candidates " +
                "repeatedly across two full days -- which makes it very hard to sustain a performance that isn't " +
                "genuine.")
        )
    ),
    DocSection(
        id = "topics/GTO.md#2",
        slug = "what-are-the-core-tasks",
        heading = "What Are the Core Tasks?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Group Discussion (GD)**: A topic (often current affairs or a case study) is discussed by the whole " +
                "group for ~15-20 minutes with no appointed leader -- assessors watch who contributes substantively, " +
                "who listens, and who dominates without adding value",
                "**Group Planning Exercise (GPE)**: The group is given a complex model situation with a map and " +
                "several problems to solve within a time limit, first individually in writing, then as a group " +
                "discussion producing one final plan",
                "**Progressive Group Task (PGT)**: A series of increasingly difficult obstacles that the group must " +
                "cross together using limited materials (planks, ropes) within rules -- physical, hands-on group " +
                "problem-solving",
                "**Half Group Task (HGT)**: A shorter, single obstacle version of PGT with half the group, giving " +
                "quieter candidates more room to contribute",
                "**Command Task**: Each candidate individually commands a small team of 2-3 (chosen by the candidate) " +
                "through an obstacle -- the one task where you are explicitly the leader and directly accountable for " +
                "the outcome",
                "**Individual Obstacles (Snake Race / Individual Obstacle Task)**: A timed course of ~10 physical " +
                "obstacles attempted individually; scored by how many are completed correctly within the time limit",
                "**Final Group Task (FGT)**: A wrap-up group obstacle task, often combining leftover elements from " +
                "earlier tasks, giving every candidate one last chance to demonstrate initiative",
                "**Lecturette**: A 3-minute solo talk on one of four topics drawn by the candidate, delivered " +
                "standing in front of the group -- tests structured thinking and public speaking under a tight time " +
                "limit"
            ))
        )
    ),
    DocSection(
        id = "topics/GTO.md#3",
        slug = "what-is-gto-actually-watching-for",
        heading = "What Is GTO Actually Watching For?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "**Initiative**: Do you propose solutions unprompted, or wait to be told what to do?",
                "**Practicality**: Do your suggestions actually work within the physical constraints (rope length, " +
                "plank count, out-of-bounds areas), or are they theoretical?",
                "**Cooperation**: Do you build on others' ideas and share credit, or push only your own plan?",
                "**Consistency of leadership**: Across 8+ tasks over two days, does the same pattern of contribution " +
                "repeat, or does it appear only once?"
            ))
        )
    ),
    DocSection(
        id = "topics/GTO.md#4",
        slug = "how-should-you-prepare",
        heading = "How Should You Prepare?",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Get physically fit ahead of time -- PGT, HGT, Command Task, and Individual Obstacles are genuinely " +
                "strenuous, and visible fatigue undermines the Stamina and Determination OLQs regardless of your " +
                "ideas",
                "Practice structuring a 3-minute Lecturette on unfamiliar topics with a clear introduction, 2-3 " +
                "points, and a conclusion -- most candidates lose marks on structure and timing, not content",
                "In group tasks, practice contributing early and specifically (\"we could use the plank as a bridge " +
                "here\") rather than waiting for the \"right moment\" to speak",
                "Study the rules of each obstacle task type beforehand (out-of-bounds zones, material limits, " +
                "helping-material rules) so you spend task time solving the problem, not learning the rules"
            ))
        )
    ),
    DocSection(
        id = "topics/GTO.md#5",
        slug = "common-mistakes",
        heading = "Common Mistakes",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Dominating the Group Discussion or PGT instead of collaborating -- GTO explicitly penalizes " +
                "candidates who \"win\" at the expense of the group's actual task completion",
                "Staying silent in group tasks out of fear of a wrong suggestion -- an imperfect, practical " +
                "suggestion beats no suggestion",
                "Ignoring physical fitness preparation and arriving unable to keep pace during outdoor tasks",
                "Treating the Command Task as a chance to show off individually rather than genuinely leading the " +
                "small team you selected"
            ))
        )
    ),
    DocSection(
        id = "topics/GTO.md#6",
        slug = "key-numbers-to-remember",
        heading = "Key Numbers to Remember",
        level = 2,
        blocks = listOf(
            ListBlock(items = listOf(
                "Duration: 2 full days (Day 3-4)",
                "Task count: 8+ distinct GTO exercises across GD, GPE, PGT, HGT, Command Task, Individual Obstacles, " +
                "FGT, and Lecturette",
                "Focus: Teamwork, practical leadership, and physical execution under time pressure"
            ))
        )
    )
    )
)
