package com.ssbmax.workers

import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TATAnalysisWorkPlannerTest {

    private val planner = TATAnalysisWorkPlanner()

    @Test
    fun `creates bounded batches for 12 stories`() {
        val plan = planner.plan("sub-001", buildStories(12), buildQuestions(12))

        assertTrue(
            "Every batch must be at most ${TATAnalysisWorkPlanner.BATCH_SIZE} wide so Gemini is not hit with all calls at once",
            plan.storyBatches.all { it.size <= TATAnalysisWorkPlanner.BATCH_SIZE }
        )
        assertEquals(4, plan.storyBatches.size)
    }

    @Test
    fun `includes every story exactly once`() {
        val plan = planner.plan("sub-002", buildStories(12), buildQuestions(12))

        val totalRequests = plan.storyBatches.sumOf { it.size }
        assertEquals(12, totalRequests)
    }

    @Test
    fun `includes blank card in planned work`() {
        // Card 12 is the programmatic blank slide — it still produces a real TATStoryResponse.
        val stories = buildStories(12)
        val plan = planner.plan("sub-003", stories, buildQuestions(12))

        val blankCardStoryId = stories.last().questionId
        val ids = plan.storyBatches.flatten().map { it.workSpec.input.getString(TATStoryAnalysisWorker.KEY_QUESTION_ID) }
        assertTrue(ids.contains(blankCardStoryId))
    }

    // TAT_Impr_3 Phase 5 regression guard: the planner is the seam where the "0 bytes" bug
    // lived. When questions carry a URL matching a story's questionId, the worker request must
    // carry that URL (plus context + gender tag) so the worker downloads real bytes.
    @Test
    fun `populates KEY_IMAGE_URL from matched question`() {
        val stories = buildStories(2)
        val plan = planner.plan("sub-reg-1", stories, buildQuestions(2))

        plan.storyBatches.flatten().forEachIndexed { index, request ->
            assertEquals(
                "https://example.com/tat_${index + 1}.jpg",
                request.workSpec.input.getString(TATStoryAnalysisWorker.KEY_IMAGE_URL)
            )
        }
    }

    @Test
    fun `populates KEY_IMAGE_CONTEXT_JSON and KEY_IMAGE_GENDER_TAG from matched question`() {
        val stories = buildStories(1)
        val questions = listOf(
            TATQuestion(
                id = "tat_q_1",
                imageUrl = "https://example.com/tat_1.jpg",
                cardPosition = 1,
                imageContextJson = "{\"setting\":\"village\"}",
                genderTag = "FEMALE"
            )
        )
        val plan = planner.plan("sub-reg-2", stories, questions)

        val request = plan.storyBatches.flatten().single()
        assertEquals(
            "{\"setting\":\"village\"}",
            request.workSpec.input.getString(TATStoryAnalysisWorker.KEY_IMAGE_CONTEXT_JSON)
        )
        assertEquals(
            "FEMALE",
            request.workSpec.input.getString(TATStoryAnalysisWorker.KEY_IMAGE_GENDER_TAG)
        )
    }

    @Test
    fun `sets KEY_IMAGE_URL empty when no question matches`() {
        // Blank-card / legacy behavior: a story whose questionId has no matching question
        // (e.g. a fresh random 12 from getTATQuestions) yields a blank KEY_IMAGE_URL, which
        // the worker degrades to ByteArray(0). This documents the bug mechanism so it cannot
        // silently return.
        val stories = buildStories(2)
        val questions = buildQuestions(2).map { it.copy(id = "different_${it.id}") }
        val plan = planner.plan("sub-reg-3", stories, questions)

        plan.storyBatches.flatten().forEach { request ->
            assertEquals("", request.workSpec.input.getString(TATStoryAnalysisWorker.KEY_IMAGE_URL))
        }
    }

    @Test
    fun `creates synthesis dependency after all batches`() {
        val plan = planner.plan("sub-004", buildStories(12), buildQuestions(12))

        assertEquals(
            "sub-004",
            plan.synthesisRequest.workSpec.input.getString(TATSynthesisWorker.KEY_SUBMISSION_ID)
        )
    }

    @Test
    fun `preserves questionId and storyIndex correctly`() {
        val stories = buildStories(12)
        val plan = planner.plan("sub-005", stories, buildQuestions(12))

        plan.storyBatches.flatten().forEachIndexed { globalIndex, request ->
            assertEquals(stories[globalIndex].questionId, request.workSpec.input.getString(TATStoryAnalysisWorker.KEY_QUESTION_ID))
            assertEquals(globalIndex, request.workSpec.input.getInt(TATStoryAnalysisWorker.KEY_STORY_INDEX, -1))
        }
    }

    private fun buildStories(count: Int): List<TATStoryResponse> = (1..count).map { i ->
        TATStoryResponse(
            questionId = "tat_q_$i",
            story = "Story $i text here.",
            charactersCount = 200,
            viewingTimeTakenSeconds = 15,
            writingTimeTakenSeconds = 120,
            submittedAt = 1_717_171_000L + i
        )
    }

    private fun buildQuestions(count: Int): List<TATQuestion> = (1..count).map { i ->
        TATQuestion(
            id = "tat_q_$i",
            imageUrl = "https://example.com/tat_$i.jpg",
            cardPosition = i,
            viewingTimeSeconds = 30,
            writingTimeMinutes = 4,
            minCharacters = 150,
            maxCharacters = 1500
        )
    }
}
