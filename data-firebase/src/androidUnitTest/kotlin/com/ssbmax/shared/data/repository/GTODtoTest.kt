package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.gto.ObstacleConfig
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Covers the real-behavior-preserving decisions GitLiveGTORepository makes: the nested-vs-legacy
 * "data" field merge, the robustness status-inference fix, the rating thresholds, and the
 * documented "PGT/HGT/GOR/IO/CT are unreachable from mapToSubmission" finding — a genuine dead-code
 * discovery in the Android original (see the class doc on GitLiveGTORepository), not something to
 * silently re-introduce as reachable here.
 */
class GTODtoTest {

    @Test
    fun `rating thresholds match the Android original's calculateRating`() {
        assertEquals("Exceptional", calculateGtoRating(1f))
        assertEquals("Exceptional", calculateGtoRating(3f))
        assertEquals("Excellent", calculateGtoRating(4f))
        assertEquals("Very Good", calculateGtoRating(5f))
        assertEquals("Good", calculateGtoRating(6f))
        assertEquals("Average", calculateGtoRating(7f))
        assertEquals("Below Average", calculateGtoRating(8f))
        assertEquals("Poor", calculateGtoRating(9.5f))
    }

    @Test
    fun `status is inferred COMPLETED when scores are present but status still says pending`() {
        assertEquals(
            GTOSubmissionStatus.COMPLETED,
            inferCompletedGtoStatus(GTOSubmissionStatus.PENDING_ANALYSIS, hasScores = true)
        )
        assertEquals(
            GTOSubmissionStatus.COMPLETED,
            inferCompletedGtoStatus(GTOSubmissionStatus.ANALYZING, hasScores = true)
        )
    }

    @Test
    fun `status is left alone when there are no scores yet or already terminal`() {
        assertEquals(
            GTOSubmissionStatus.PENDING_ANALYSIS,
            inferCompletedGtoStatus(GTOSubmissionStatus.PENDING_ANALYSIS, hasScores = false)
        )
        assertEquals(
            GTOSubmissionStatus.FAILED,
            inferCompletedGtoStatus(GTOSubmissionStatus.FAILED, hasScores = true)
        )
    }

    @Test
    fun `parseGtoSubmissionTestType only recognizes GD GPE and Lecturette wire names`() {
        assertEquals(GTOTestType.GROUP_DISCUSSION, parseGtoSubmissionTestType("GTO_GD"))
        assertEquals(GTOTestType.GROUP_DISCUSSION, parseGtoSubmissionTestType("GROUP_DISCUSSION"))
        assertEquals(GTOTestType.GROUP_PLANNING_EXERCISE, parseGtoSubmissionTestType("GTO_GPE"))
        assertEquals(GTOTestType.LECTURETTE, parseGtoSubmissionTestType("LECTURETTE"))
        // Same limitation as the Android original's mapToSubmission: animation types are never
        // reachable here (see GitLiveGTORepository's class doc for why this is a faithful port,
        // not a regression).
        assertNull(parseGtoSubmissionTestType("GTO_PGT"))
        assertNull(parseGtoSubmissionTestType("PROGRESSIVE_GROUP_TASK"))
        assertNull(parseGtoSubmissionTestType("bogus"))
    }

    @Test
    fun `nested data fields win over root-level legacy fields when data is present`() {
        val dto = GTOSubmissionDocDto(
            id = "sub-1",
            userId = "user-1",
            testId = "test-1",
            testType = "GTO_GD",
            submittedAt = 1_700_000_000_000L,
            status = "PENDING_ANALYSIS",
            data = GTOSubmissionFieldsDto(topic = "Nested topic", response = "Nested response", charCount = 42),
            // Legacy root-level fields present too — must be ignored since `data` exists.
            topic = "Legacy topic",
            response = "Legacy response",
            charCount = 7
        )

        val submission = dto.toDomain() as GTOSubmission.GDSubmission
        assertEquals("Nested topic", submission.topic)
        assertEquals("Nested response", submission.response)
        assertEquals(42, submission.charCount)
    }

    @Test
    fun `root-level legacy fields are used when data is entirely absent`() {
        val dto = GTOSubmissionDocDto(
            id = "sub-2",
            userId = "user-2",
            testId = "test-2",
            testType = "GROUP_DISCUSSION",
            submittedAt = 1_700_000_000_000L,
            status = "COMPLETED",
            data = null,
            topic = "Legacy topic",
            response = "Legacy response",
            charCount = 7
        )

        val submission = dto.toDomain() as GTOSubmission.GDSubmission
        assertEquals("Legacy topic", submission.topic)
        assertEquals("Legacy response", submission.response)
        assertEquals(7, submission.charCount)
    }

    @Test
    fun `unsupported test type throws instead of silently decoding as GD`() {
        val dto = GTOSubmissionDocDto(id = "sub-3", userId = "u", testId = "t", testType = "GTO_PGT")
        assertFailsWithIllegalArgument { dto.toDomain() }
    }

    @Test
    fun `GTOResultDto fills missing OLQs with a default score rather than dropping them`() {
        val dto = GTOResultDto(
            submissionId = "sub-1",
            userId = "user-1",
            testType = "GROUP_DISCUSSION",
            olqScores = mapOf("EFFECTIVE_INTELLIGENCE" to OLQScoreDto(score = 3, confidence = 80, reasoning = "Strong")),
            overallScore = 4.5f,
            overallRating = "Excellent",
            aiConfidence = 80,
            analyzedAt = 1_700_000_000_000L
        )

        val result = dto.toDomain()
        assertEquals(15, result.olqScores.size)
        assertEquals(3, result.olqScores[com.ssbmax.shared.domain.model.interview.OLQ.EFFECTIVE_INTELLIGENCE]?.score)
        assertEquals(1, result.olqScores[com.ssbmax.shared.domain.model.interview.OLQ.COURAGE]?.score)
        assertEquals("Not analyzed", result.olqScores[com.ssbmax.shared.domain.model.interview.OLQ.COURAGE]?.reasoning)
    }

    @Test
    fun `GTOResultDto toDomain never throws on out-of-range legacy scores`() {
        // OLQScore/GTOResult both require their score in 1..10 (1f..10f for overallScore) --
        // the Android original filled missing/corrupt values with 0/0f, which violates that
        // invariant and throws IllegalArgumentException for any partially-analyzed or malformed
        // gto_results doc. This pins that toDomain() instead coerces into range so the read path
        // degrades to a placeholder result rather than crashing on exactly the data it must tolerate.
        val dto = GTOResultDto(
            submissionId = "sub-1",
            userId = "user-1",
            testType = "GROUP_DISCUSSION",
            olqScores = mapOf("COURAGE" to OLQScoreDto(score = 0, confidence = 150, reasoning = "corrupt")),
            overallScore = 0f,
            overallRating = "Unknown",
            aiConfidence = -5
        )

        val result = dto.toDomain()
        assertEquals(1, result.olqScores[com.ssbmax.shared.domain.model.interview.OLQ.COURAGE]?.score)
        assertEquals(100, result.olqScores[com.ssbmax.shared.domain.model.interview.OLQ.COURAGE]?.confidence)
        assertEquals(1f, result.overallScore)
        assertEquals(0, result.aiConfidence)
    }

    @Test
    fun `GTOProgressDto round-trips and drops unparseable test type names instead of throwing`() {
        val dto = GTOProgressDto(
            completedTests = listOf("GROUP_DISCUSSION", "NOT_A_REAL_TYPE"),
            currentSequentialOrder = 2
        )

        val progress = dto.toDomain("user-1")
        assertEquals(listOf(GTOTestType.GROUP_DISCUSSION), progress.completedTests)
        assertEquals(2, progress.currentSequentialOrder)
    }

    @Test
    fun `createGtoAnimationTest falls back to a default obstacle when the list is empty`() {
        val test = createGtoAnimationTest(GTOTestType.HALF_GROUP_TASK, emptyList())
        val hgt = test as com.ssbmax.shared.domain.model.gto.GTOTest.HGTTest
        assertEquals("default", hgt.obstacle.id)
    }

    @Test
    fun `createGtoAnimationTest carries the full obstacle list through for PGT`() {
        val obstacles = listOf(
            ObstacleConfig(id = "o1", name = "Wall", description = "d", difficulty = 1, animationAsset = "a"),
            ObstacleConfig(id = "o2", name = "Ditch", description = "d", difficulty = 2, animationAsset = "a")
        )
        val test = createGtoAnimationTest(GTOTestType.PROGRESSIVE_GROUP_TASK, obstacles)
        val pgt = test as com.ssbmax.shared.domain.model.gto.GTOTest.PGTTest
        assertEquals(2, pgt.obstacles.size)
    }

    @Test
    fun `obstacleTestTypePath maps only animation types and returns null for GD-style tests`() {
        assertEquals("pgt", obstacleTestTypePath(GTOTestType.PROGRESSIVE_GROUP_TASK))
        assertEquals("ct", obstacleTestTypePath(GTOTestType.COMMAND_TASK))
        assertNull(obstacleTestTypePath(GTOTestType.GROUP_DISCUSSION))
        assertNull(obstacleTestTypePath(GTOTestType.GROUP_PLANNING_EXERCISE))
    }

    @Test
    fun `ObstacleConfigDto toDomain fills in defaults for missing optional fields`() {
        val dto = ObstacleConfigDto(id = "o1", name = "Wall")
        val obstacle = dto.toDomain()
        assertEquals("o1", obstacle.id)
        assertEquals("Wall", obstacle.name)
        assertEquals("", obstacle.description)
        assertEquals(1, obstacle.difficulty)
        assertTrue(obstacle.resources.isEmpty())
        assertNull(obstacle.height)
    }
}

private inline fun assertFailsWithIllegalArgument(block: () -> Unit) {
    try {
        block()
        throw AssertionError("Expected IllegalArgumentException but nothing was thrown")
    } catch (e: IllegalArgumentException) {
        // expected
    }
}
