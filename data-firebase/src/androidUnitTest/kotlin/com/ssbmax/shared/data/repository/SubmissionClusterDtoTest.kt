package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.OIRAnswer
import com.ssbmax.shared.domain.model.OIRAnsweredQuestion
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.model.SRTCategory
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import kotlin.test.Test
import kotlinx.serialization.json.Json
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Covers the shared OLQ DTO and the per-test-type submission DTOs ported for the
 * submission-repository cluster slice. Each case protects a real behavior called out in the
 * ported classes' doc comments — not a trivial getter test.
 */
class SubmissionClusterDtoTest {

    @Test
    fun `OLQAnalysisResultDto round-trips through toDto and toDomain`() {
        val domain = com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult(
            submissionId = "sub-1",
            testType = TestType.TAT,
            olqScores = mapOf(
                com.ssbmax.shared.domain.model.interview.OLQ.EFFECTIVE_INTELLIGENCE to
                    com.ssbmax.shared.domain.model.interview.OLQScore(score = 8, confidence = 90, reasoning = "Strong")
            ),
            overallScore = 7.5f,
            overallRating = "Good",
            strengths = listOf("Clarity"),
            weaknesses = listOf("Pacing"),
            recommendations = listOf("Practice more"),
            analyzedAt = 1_700_000_000_000L,
            aiConfidence = 85
        )

        val dto = domain.toDto(userId = "user-1")
        assertEquals("user-1", dto.userId)
        assertEquals("TAT", dto.testType)

        val roundTripped = dto.toDomain()
        assertEquals(domain.submissionId, roundTripped?.submissionId)
        assertEquals(domain.testType, roundTripped?.testType)
        assertEquals(8, roundTripped?.olqScores?.get(com.ssbmax.shared.domain.model.interview.OLQ.EFFECTIVE_INTELLIGENCE)?.score)
    }

    @Test
    fun `OLQAnalysisResultDto with unparseable testType returns null instead of throwing`() {
        val dto = OLQAnalysisResultDto(submissionId = "sub-2", testType = "NOT_A_REAL_TYPE")
        assertNull(dto.toDomain())
    }

    @Test
    fun `OLQAnalysisResultDto drops unparseable OLQ keys instead of throwing`() {
        val dto = OLQAnalysisResultDto(
            submissionId = "sub-3",
            testType = "WAT",
            olqScores = mapOf(
                "EFFECTIVE_INTELLIGENCE" to OLQScoreDto(score = 6, confidence = 50, reasoning = ""),
                "NOT_A_REAL_OLQ" to OLQScoreDto(score = 1, confidence = 1, reasoning = "")
            )
        )
        val domain = dto.toDomain()
        assertEquals(1, domain?.olqScores?.size)
    }

    @Test
    fun `TATDataDto with unparseable status falls back to SUBMITTED_PENDING_REVIEW`() {
        val dto = TATDataDto(id = "s1", userId = "u1", testId = "t1", status = "GARBAGE")
        assertEquals(SubmissionStatus.SUBMITTED_PENDING_REVIEW, dto.toDomain().status)
    }

    @Test
    fun `TATQuestionDto round-trips every field through toDto and toDomain`() {
        val question = com.ssbmax.shared.domain.model.TATQuestion(
            id = "tat_046_male",
            imageUrl = "https://storage.googleapis.com/ssbmax.app/tat_046_male.jpg",
            cardPosition = 4,
            imageContextJson = "{\"setting\":\"village\"}",
            genderTag = "MALE",
            viewingTimeSeconds = 45,
            writingTimeMinutes = 5,
            minCharacters = 200,
            maxCharacters = 2000
        )

        val dto = question.toDto()
        assertEquals("tat_046_male", dto.id)
        assertEquals("https://storage.googleapis.com/ssbmax.app/tat_046_male.jpg", dto.imageUrl)
        assertEquals(4, dto.cardPosition)
        assertEquals("{\"setting\":\"village\"}", dto.imageContextJson)
        assertEquals("MALE", dto.genderTag)
        assertEquals(45, dto.viewingTimeSeconds)
        assertEquals(5, dto.writingTimeMinutes)
        assertEquals(200, dto.minCharacters)
        assertEquals(2000, dto.maxCharacters)

        val roundTripped = dto.toDomain()
        assertEquals(question, roundTripped)
    }

    @Test
    fun `TATSubmission toDto round-trips questions preserving id imageUrl context genderTag and cardPosition`() {
        val submission = com.ssbmax.shared.domain.model.TATSubmission(
            id = "sub-1",
            userId = "u1",
            testId = "tat_standard",
            stories = listOf(
                com.ssbmax.shared.domain.model.TATStoryResponse(
                    questionId = "q1", story = "Story", charactersCount = 5,
                    viewingTimeTakenSeconds = 10, writingTimeTakenSeconds = 120, submittedAt = 1L
                )
            ),
            questions = listOf(
                com.ssbmax.shared.domain.model.TATQuestion(
                    id = "q1", imageUrl = "https://example.com/1.png", cardPosition = 1,
                    imageContextJson = "{\"setting\":\"river\"}", genderTag = "MIXED"
                ),
                com.ssbmax.shared.domain.model.TATQuestion(
                    id = "q2", imageUrl = "https://example.com/2.png", cardPosition = 2,
                    imageContextJson = "{}", genderTag = "FEMALE"
                )
            ),
            totalTimeTakenMinutes = 45,
            submittedAt = 2L
        )

        val dto = TATDataDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            stories = submission.stories.map { it.toDto() },
            questions = submission.questions.map { it.toDto() },
            totalTimeTakenMinutes = submission.totalTimeTakenMinutes,
            submittedAt = submission.submittedAt,
            status = submission.status.name
        )

        val roundTripped = dto.toDomain()
        assertEquals(2, roundTripped.questions.size)
        assertEquals("q1", roundTripped.questions[0].id)
        assertEquals("https://example.com/1.png", roundTripped.questions[0].imageUrl)
        assertEquals("{\"setting\":\"river\"}", roundTripped.questions[0].imageContextJson)
        assertEquals("MIXED", roundTripped.questions[0].genderTag)
        assertEquals(1, roundTripped.questions[0].cardPosition)
        assertEquals("q2", roundTripped.questions[1].id)
        assertEquals("FEMALE", roundTripped.questions[1].genderTag)
    }

    @Test
    fun `legacy TATDataDto without questions field decodes to empty questions list`() {
        // Backward compatibility: docs written before TAT_Impr_3 have no `questions`
        // field. The defaulted DTO field must decode to emptyList() so the analysis
        // paths fall back to a repo fetch instead of crashing.
        val legacyJson = """
            {
              "id": "s1",
              "userId": "u1",
              "testId": "t1",
              "stories": [],
              "totalTimeTakenMinutes": 45,
              "submittedAt": 1,
              "status": "SUBMITTED_PENDING_REVIEW"
            }
        """.trimIndent()

        val dto = Json.decodeFromString(TATDataDto.serializer(), legacyJson)
        assertTrue(dto.questions.isEmpty())
        assertEquals(emptyList(), dto.toDomain().questions)
    }

    @Test
    fun `SRTInstructorScoreDto drops unparseable category keys same defensive behavior as Android`() {
        val dto = SRTInstructorScoreDto(
            gradedByInstructorId = "i1",
            gradedByInstructorName = "Instructor",
            gradedAt = 0L,
            categoryWiseComments = mapOf(
                "LEADERSHIP" to "Good call under pressure",
                "NOT_A_CATEGORY" to "should be dropped"
            )
        )
        val domain = dto.toDomain()
        assertEquals(1, domain.categoryWiseComments.size)
        assertEquals("Good call under pressure", domain.categoryWiseComments[SRTCategory.LEADERSHIP])
    }

    @Test
    fun `OIR submission round-trips summary breakdowns and answer review data`() {
        val question = OIRQuestion(
            id = "q1",
            questionNumber = 1,
            type = OIRQuestionType.VERBAL_REASONING,
            questionText = "Choose the correct option",
            options = listOf(OIROption("a", "Alpha"), OIROption("b", "Beta")),
            correctAnswerId = "a",
            explanation = "Alpha is correct",
            difficulty = QuestionDifficulty.HARD
        )
        val answered = OIRAnsweredQuestion(
            question = question,
            userAnswer = OIRAnswer("q1", "b", false, 12, selectedOptionIds = setOf("b")),
            isCorrect = false,
            correctOption = question.options.first(),
            selectedOption = question.options[1],
            correctOptions = listOf(question.options.first()),
            selectedOptions = listOf(question.options[1])
        )
        val submission = com.ssbmax.shared.domain.model.OIRSubmission(
            id = "oir-1",
            userId = "u1",
            testId = "t1",
            testResult = OIRTestResult(
                testId = "t1", sessionId = "session-1", userId = "u1",
                totalQuestions = 50, correctAnswers = 40, incorrectAnswers = 8, skippedQuestions = 2,
                totalTimeSeconds = 2400, timeTakenSeconds = 1200, rawScore = 40, percentageScore = 80f,
                categoryScores = mapOf(OIRQuestionType.VERBAL_REASONING to com.ssbmax.shared.domain.model.CategoryScore(
                    OIRQuestionType.VERBAL_REASONING, 20, 16, 80f, 30
                )),
                difficultyBreakdown = mapOf(QuestionDifficulty.HARD to com.ssbmax.shared.domain.model.DifficultyScore(
                    QuestionDifficulty.HARD, 10, 7, 70f
                )),
                answeredQuestions = listOf(answered), completedAt = 1_700_000_000_000L
            ),
            submittedAt = 1_700_000_000_001L,
            status = SubmissionStatus.SUBMITTED_PENDING_REVIEW
        )

        val dto = submission.toDataDto()
        val roundTripped = dto.toDomain()
        assertTrue(dto.testResult.difficultyBreakdown.isEmpty())
        assertEquals(submission.testResult.copy(difficultyBreakdown = emptyMap()), roundTripped.testResult)
        assertEquals(submission.id, roundTripped.id)
    }

    @Test
    fun `new OIR result serialization omits legacy difficulty breakdown`() {
        val dto = OIRSubmissionTestResultDto(
            totalQuestions = 50,
            correctAnswers = 25,
            rawScore = 25,
            percentageScore = 50f
        )

        val encoded = Json.encodeToString(OIRSubmissionTestResultDto.serializer(), dto)

        assertFalse(encoded.contains("difficultyBreakdown"))
    }

    @Test
    fun `legacy OIR result with complete difficulty breakdown still parses`() {
        val legacyJson = """
            {
              "totalQuestions": 50,
              "correctAnswers": 40,
              "rawScore": 40,
              "percentageScore": 80.0,
              "difficultyBreakdown": {
                "EASY": {"totalQuestions": 20, "correctAnswers": 16, "percentage": 80.0},
                "BROKEN": {"totalQuestions": 10, "correctAnswers": 0, "percentage": 0.0}
              }
            }
        """.trimIndent()

        val dto = Json.decodeFromString(OIRSubmissionTestResultDto.serializer(), legacyJson)

        assertEquals(40, dto.correctAnswers)
        assertEquals(2, dto.difficultyBreakdown.size)
        assertTrue(dto.difficultyBreakdown.containsKey("BROKEN"))
    }

    @Test
    fun `OIR result mapper drops malformed enum keys and defaults missing optional fields`() {
        val dto = OirTestResultDto(
            categoryScores = mapOf("VERBAL_REASONING" to OirCategoryScoreDto(10, 8, 80f, 20), "BROKEN" to OirCategoryScoreDto()),
            difficultyBreakdown = mapOf("NOT_A_DIFFICULTY" to OirDifficultyScoreDto()),
            answeredQuestions = emptyList()
        )
        val result = dto.toDomain()
        assertEquals(1, result.categoryScores.size)
        assertTrue(result.difficultyBreakdown.isEmpty())
        assertEquals(0, result.totalTimeSeconds)
    }

    @Test
    fun `PPDT data DTO defaults analysisStatus to PENDING_ANALYSIS when never written`() {
        val dto = PPDTDataDto(submissionId = "p1", questionId = "q1", userId = "u1", status = "SUBMITTED_PENDING_REVIEW")
        assertEquals(com.ssbmax.shared.domain.model.scoring.AnalysisStatus.PENDING_ANALYSIS, dto.toDomain().analysisStatus)
        assertNull(dto.toDomain().olqResult)
    }

    @Test
    fun `PIQDataDto round-trips every top-level and nested section field`() {
        val domain = com.ssbmax.shared.domain.model.PIQSubmission(
            id = "piq-1",
            userId = "u1",
            fullName = "Cadet Test",
            dateOfBirth = "2000-01-01",
            siblings = listOf(com.ssbmax.shared.domain.model.Sibling(id = "sib-1", name = "Sibling One")),
            education10th = com.ssbmax.shared.domain.model.Education(level = "10th", institution = "School A", percentage = "92"),
            workExperience = listOf(com.ssbmax.shared.domain.model.WorkExperience(id = "we-1", company = "Acme")),
            nccTraining = com.ssbmax.shared.domain.model.NCCTraining(hasTraining = true, wing = "Army"),
            previousInterviews = listOf(com.ssbmax.shared.domain.model.PreviousInterview(id = "pi-1", ssbNumber = "SSB-1")),
            status = SubmissionStatus.SUBMITTED_PENDING_REVIEW
        )

        val dto = domain.toDataDto()
        val roundTripped = dto.toDomain()

        assertEquals(domain.id, roundTripped.id)
        assertEquals(domain.fullName, roundTripped.fullName)
        assertEquals(1, roundTripped.siblings.size)
        assertEquals("Sibling One", roundTripped.siblings.first().name)
        assertEquals("School A", roundTripped.education10th.institution)
        assertEquals("Acme", roundTripped.workExperience.first().company)
        assertTrue(roundTripped.nccTraining.hasTraining)
        assertEquals("SSB-1", roundTripped.previousInterviews.first().ssbNumber)
        assertEquals(SubmissionStatus.SUBMITTED_PENDING_REVIEW, roundTripped.status)
    }

    @Test
    fun `PIQDataDto with unparseable status falls back to SUBMITTED_PENDING_REVIEW`() {
        val dto = PIQDataDto(id = "p1", userId = "u1", status = "GARBAGE")
        assertEquals(SubmissionStatus.SUBMITTED_PENDING_REVIEW, dto.toDomain().status)
    }

    @Test
    fun `PIQ aiPreliminaryScore is written but never round-tripped same real limitation as the Android original`() {
        val domain = com.ssbmax.shared.domain.model.PIQSubmission(
            id = "piq-2",
            userId = "u1",
            aiPreliminaryScore = com.ssbmax.shared.domain.model.PIQAIScore(
                overallScore = 80f,
                personalInfoScore = 20f,
                familyInfoScore = 20f,
                motivationScore = 20f,
                selfAssessmentScore = 20f,
                feedback = "Good",
                strengths = listOf("Clarity"),
                areasForImprovement = emptyList(),
                completenessPercentage = 100,
                clarityScore = 9f,
                consistencyScore = 9f
            )
        )

        val dto = domain.toDataDto()
        assertEquals(80f, dto.aiPreliminaryScore?.overallScore)

        val roundTripped = dto.toDomain()
        assertNull(roundTripped.aiPreliminaryScore)
    }

    @Test
    fun `GTO submission envelope keeps GTOSubmissionStatus in the shared status field same quirk as Android`() {
        val doc = SubmissionDocDto(
            id = "gd-1",
            userId = "u1",
            testId = "t1",
            testType = TestType.GTO_GD.name,
            status = "PENDING_ANALYSIS", // GTOSubmissionStatus name, not SubmissionStatus
            data = GDSubmissionDataDto(topic = "Leadership", response = "My answer")
        )
        assertEquals("PENDING_ANALYSIS", doc.status)
        assertEquals("Leadership", doc.data.topic)
    }
}
