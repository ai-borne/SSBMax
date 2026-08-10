@file:OptIn(ExperimentalUuidApi::class)
package com.ssbmax.shared.domain.model

import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/**
 * TAT (Thematic Apperception Test) - Phase 2 Psychology Test
 * 
 * Student is shown a series of ambiguous pictures (typically 11-12 pictures)
 * and must write a story for each picture within 30 seconds viewing + 4 minutes writing.
 */

/**
 * Represents a single TAT image/picture card
 */
data class TATQuestion(
    val id: String = Uuid.random().toString(),
    val imageUrl: String,
    val cardPosition: Int, // 1–11 (pool slot); 12 = programmatic blank card
    val imageContextJson: String = "{}", // JSON-serialized TATImageContext for AI scoring
    val genderTag: String = "MIXED", // MALE/FEMALE/MIXED — controls R4 protagonist gender rule
    val viewingTimeSeconds: Int = 30,
    val writingTimeMinutes: Int = 4,
    val minCharacters: Int = 150,
    val maxCharacters: Int = 1500
)

/**
 * Student's response to a single TAT picture
 */
data class TATStoryResponse(
    val questionId: String,
    val story: String,
    val charactersCount: Int,
    val viewingTimeTakenSeconds: Int,
    val writingTimeTakenSeconds: Int,
    val submittedAt: Long
)

/**
 * Complete TAT test submission (all 11-12 stories)
 */
data class TATSubmission(
    val id: String = Uuid.random().toString(),
    val userId: String,
    val testId: String,
    val stories: List<TATStoryResponse>,
    // The exact set of questions the user saw. Persisted on the submission so both
    // analysis paths (Android WorkManager + iOS/shared) can recover the questionId →
    // imageUrl/imageContextJson/genderTag mapping instead of re-fetching a fresh random
    // set (TAT_Impr_3). Defaulted to emptyList() so existing construction sites compile
    // unchanged; legacy docs decode to emptyList() and fall back to a repo fetch.
    val questions: List<TATQuestion> = emptyList(),
    val totalTimeTakenMinutes: Int,
    val submittedAt: Long,
    val status: SubmissionStatus = SubmissionStatus.SUBMITTED_PENDING_REVIEW,
    val instructorScore: TATInstructorScore? = null,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    // OLQ-based analysis fields (Phase 1)
    val analysisStatus: AnalysisStatus = AnalysisStatus.PENDING_ANALYSIS,
    val olqResult: OLQAnalysisResult? = null
) {
    val totalStories: Int get() = stories.size
    val isComplete: Boolean get() = stories.size >= 11
    val averageStoryLength: Int get() = stories.map { it.charactersCount }.average().toInt()
}



/**
 * Instructor's final grading for TAT
 */
data class TATInstructorScore(
    val overallScore: Float, // 0-100
    val thematicPerceptionScore: Float,
    val imaginationScore: Float,
    val characterDepictionScore: Float,
    val emotionalToneScore: Float,
    val narrativeStructureScore: Float,
    val feedback: String,
    val storyWiseComments: Map<String, String> = emptyMap(), // questionId -> comment
    val gradedByInstructorId: String,
    val gradedByInstructorName: String,
    val gradedAt: Long,
    val agreedWithAI: Boolean = false
)

/**
 * TAT test session tracking
 */
data class TATTestSession(
    val sessionId: String = Uuid.random().toString(),
    val userId: String,
    val testId: String,
    val questions: List<TATQuestion>,
    val currentQuestionIndex: Int = 0,
    val responses: List<TATStoryResponse> = emptyList(),
    val currentPhase: TATPhase = TATPhase.INSTRUCTIONS,
    val currentStory: String = "",
    val startTime: Long,
    val viewingStartTime: Long? = null,
    val writingStartTime: Long? = null,
    val isPaused: Boolean = false,
    val isCompleted: Boolean = false
) {
    val currentQuestion: TATQuestion?
        get() = questions.getOrNull(currentQuestionIndex)
    
    val progress: Float
        get() = if (questions.isEmpty()) 0f else (currentQuestionIndex.toFloat() / questions.size)
    
    val completedStories: Int
        get() = responses.size
    
    val remainingStories: Int
        get() = questions.size - responses.size
}

/**
 * TAT test phases
 */
enum class TATPhase {
    INSTRUCTIONS,
    IMAGE_VIEWING,
    WRITING,
    REVIEW,
    SUBMITTED;
    
    val displayName: String
        get() = when (this) {
            INSTRUCTIONS -> "Instructions"
            IMAGE_VIEWING -> "Viewing Image"
            WRITING -> "Writing Story"
            REVIEW -> "Review"
            SUBMITTED -> "Submitted"
        }
}

/**
 * TAT test configuration
 */
data class TATTestConfig(
    val testId: String = "tat_standard",
    val title: String = "TAT - Thematic Apperception Test",
    val description: String = "Write stories based on ambiguous pictures",
    val totalPictures: Int = 12,
    val viewingTimePerPictureSeconds: Int = 30,
    val writingTimePerPictureMinutes: Int = 4,
    val minCharactersPerStory: Int = 150,
    val maxCharactersPerStory: Int = 1500,
    val showAIScore: Boolean = true,
    val requiresInstructorReview: Boolean = true,
    val allowSkip: Boolean = false, // Force sequential completion
    val allowReviewBeforeSubmit: Boolean = true
)

/**
 * TAT result for display
 */
data class TATResult(
    val sessionId: String,
    val userId: String,
    val testId: String,
    val submission: TATSubmission,
    val overallScore: Float?,
    val status: SubmissionStatus,
    val attemptedAt: Long
)

