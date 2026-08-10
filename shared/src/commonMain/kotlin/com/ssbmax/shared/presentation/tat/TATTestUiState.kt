package com.ssbmax.shared.presentation.tat

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TATPhase
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TATTestConfig
import com.ssbmax.shared.presentation.common.TestError

/**
 * KMP port of `app/.../ui/tests/tat/TATTestUiState.kt`. Field-for-field match
 * with the Android original (including the derived properties below) so
 * [TATTestViewModel]'s logic is a near drop-in. `error: String?` was typed to
 * [TestError]? in Phase 8 of the subscription-override plan to stop raw
 * exception text (e.g. `PERMISSION_DENIED: ...`) from reaching the screen.
 */
data class TATTestUiState(
    val isLoading: Boolean = true,
    val loadingMessage: String? = null,
    val testId: String = "",
    val questions: List<TATQuestion> = emptyList(),
    val config: TATTestConfig? = null,
    val currentQuestionIndex: Int = 0,
    val responses: List<TATStoryResponse> = emptyList(),
    val currentStory: String = "",
    val phase: TATPhase = TATPhase.INSTRUCTIONS,
    val viewingTimeRemaining: Int = 30,
    val writingTimeRemaining: Int = 240,
    val startTime: Long = 0L,
    val isSubmitted: Boolean = false,
    val submissionId: String? = null,
    val subscriptionType: SubscriptionTier? = null,
    val submission: TATSubmission? = null,
    val error: TestError? = null,
    val isProfileIncomplete: Boolean = false,
    val isLimitReached: Boolean = false,
    val subscriptionTier: SubscriptionTier = SubscriptionTier.FREE,
    val testsLimit: Int = 1,
    val testsUsed: Int = 0,
    val resetsAt: String = "",
    val isTimerActive: Boolean = false,
    val timerStartTime: Long = 0L // generation token for timer race prevention
) {
    val currentQuestion: TATQuestion?
        get() = questions.getOrNull(currentQuestionIndex)

    val completedStories: Int
        get() = responses.size

    /** Number shown in the submit confirmation, including a valid unsaved draft. */
    val storiesReadyToSubmit: Int
        get() {
            val currentQuestionId = currentQuestion?.id ?: return completedStories
            val currentStoryIsNew = responses.none { it.questionId == currentQuestionId }
            val currentStoryIsValid = currentStory.length >= (currentQuestion?.minCharacters ?: 150) &&
                currentStory.length <= (currentQuestion?.maxCharacters ?: 1500)
            return completedStories + if (currentStoryIsNew && currentStoryIsValid) 1 else 0
        }

    val progress: Float
        get() = if (questions.isEmpty()) 0f else (completedStories.toFloat() / questions.size)

    val isLastQuestion: Boolean
        get() = questions.isNotEmpty() && currentQuestionIndex == questions.lastIndex

    val canMoveToNextQuestion: Boolean
        get() = when (phase) {
            TATPhase.WRITING -> currentStory.length >= (currentQuestion?.minCharacters ?: 150) &&
                currentStory.length <= (currentQuestion?.maxCharacters ?: 1500)
            TATPhase.REVIEW -> true
            else -> false
        }

    val canSubmitTest: Boolean
        get() = completedStories >= questions.size || (isLastQuestion && canMoveToNextQuestion)
}
