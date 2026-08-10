package com.ssbmax.shared.domain.model

/**
 * Progress data models for test tracking
 */

/**
 * Phase 1 (Screening) progress
 */
data class Phase1Progress(
    val oirProgress: TestProgress,
    val ppdtProgress: TestProgress
) {
    val completionPercentage: Float
        get() {
            val completed = listOf(oirProgress, ppdtProgress).count { 
                it.status == TestStatus.COMPLETED || it.status == TestStatus.GRADED 
            }
            return (completed.toFloat() / 2) * 100
        }
}

/**
 * Phase 2 (Assessment) progress
 */
data class Phase2Progress(
    val psychologyProgress: TestProgress,  // Groups TAT/WAT/SRT/SD
    val gtoProgress: TestProgress,
    val interviewProgress: TestProgress
) {
    val completionPercentage: Float
        get() {
            val completed = listOf(psychologyProgress, gtoProgress, interviewProgress).count { 
                it.status == TestStatus.COMPLETED || it.status == TestStatus.GRADED 
            }
            return (completed.toFloat() / 3) * 100
        }
}

/**
 * Individual test progress
 */
data class TestProgress(
    val testType: TestType,
    val status: TestStatus = TestStatus.NOT_ATTEMPTED,
    val lastAttemptDate: Long? = null,
    val latestScore: Float? = null,
    val isPendingReview: Boolean = false,
    /** True only while an AI result is being generated, not while awaiting instructor review. */
    val isAnalysisPending: Boolean = false
)

