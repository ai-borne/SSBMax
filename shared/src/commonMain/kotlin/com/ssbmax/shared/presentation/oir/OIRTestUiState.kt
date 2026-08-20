package com.ssbmax.shared.presentation.oir

import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.OIRTestSession
import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * KMP port of the Android `app/.../ui/tests/oir/OIRTestUiState.kt`.
 *
 * One real shape change from the Android original: `@StringRes errorResId: Int?`
 * becomes [errorType] (an [OIRErrorType] enum) — `androidx.annotation.StringRes`
 * has no multiplatform equivalent, and this presentation module must stay
 * Compose-free (no `androidx.compose.ui.res.stringResource` dependency here).
 * [com.ssbmax.shared.ui.oir.OIRTestScreen] maps each enum value to its
 * `Res.string.oir_error_*` resource — same strings as the Android original,
 * just resolved at the UI layer instead of carried as a resource ID through
 * the ViewModel.
 */
data class OIRTestUiState(
    val isLoading: Boolean = true,
    val errorType: OIRErrorType? = null,
    val currentQuestion: OIRQuestion? = null,
    val currentQuestionIndex: Int = 0,
    val totalQuestions: Int = 0,
    val timeRemainingSeconds: Int = 0,
    val selectedOptionIds: Set<String> = emptySet(),
    val showFeedback: Boolean = false,
    val isCurrentAnswerCorrect: Boolean = false,
    val currentQuestionAnswered: Boolean = false,
    val isCompleted: Boolean = false,
    val isSubmitting: Boolean = false,
    val showSubmitConfirmation: Boolean = false,
    val submissionId: String? = null,
    val subscriptionType: SubscriptionTier? = null,
    /** Result calculated locally after submission — no extra Firestore read needed. */
    val testResult: OIRTestResult? = null,
    // Subscription limit fields
    val isLimitReached: Boolean = false,
    val subscriptionTier: SubscriptionTier = SubscriptionTier.FREE,
    val testsLimit: Int = 1,
    val testsUsed: Int = 0,
    val resetsAt: String = "",
    val isTimerActive: Boolean = false,
    val timerStartTime: Long = 0L,
    /** Epoch ms when the current question was first displayed. Used for per-question timeTakenSeconds. */
    val questionStartTimeMs: Long = 0L,
    /** Active test session kept in observable state for lifecycle-safe access. */
    val session: OIRTestSession? = null
)

enum class OIRErrorType {
    AUTH_REQUIRED,
    QUESTIONS_UNAVAILABLE,
    SUBMIT_FAILED,
    SESSION_UNAVAILABLE,
    INVALID_QUESTION
}
