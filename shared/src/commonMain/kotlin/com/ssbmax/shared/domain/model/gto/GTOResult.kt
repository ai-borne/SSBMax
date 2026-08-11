package com.ssbmax.shared.domain.model.gto

import kotlin.time.Clock

import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore

/**
 * GTO Test Result
 * Contains AI analysis with 15 OLQ scores
 */
data class GTOResult(
    val submissionId: String,
    val userId: String,
    val testType: GTOTestType,
    val olqScores: Map<OLQ, OLQScore>,
    val overallScore: Float, // 1-10 scale (lower is better, SSB convention)
    val overallRating: String, // "Exceptional", "Very Good", "Average", etc.
    val strengths: List<String> = emptyList(),
    val weaknesses: List<String> = emptyList(),
    val recommendations: List<String> = emptyList(),
    val analyzedAt: Long = Clock.System.now().toEpochMilliseconds(),
    val aiConfidence: Int // 0-100% confidence in analysis
) {
    init {
        require(overallScore in 1f..10f) { "Overall score must be between 1 and 10" }
        require(aiConfidence in 0..100) { "AI confidence must be between 0 and 100" }
        // require(olqScores.size == 15) { "All 15 OLQs must be scored" } // Relaxed constraint
    }
    
    /**
     * Calculate overall rating based on average OLQ scores
     */
    val calculatedRating: String
        get() = when {
            overallScore <= 3f -> "Exceptional"
            overallScore <= 4f -> "Excellent"
            overallScore <= 5f -> "Very Good"
            overallScore <= 6f -> "Good"
            overallScore <= 7f -> "Average"
            overallScore <= 8f -> "Below Average"
            else -> "Poor"
        }
    
    /**
     * Get top 3 OLQs (lowest scores = best performance)
     */
    val topOLQs: List<Pair<OLQ, OLQScore>>
        get() = olqScores.entries
            .sortedBy { it.value.score }
            .take(3)
            .map { it.key to it.value }
    
    /**
     * Get bottom 3 OLQs (highest scores = needs improvement)
     */
    val improvementOLQs: List<Pair<OLQ, OLQScore>>
        get() = olqScores.entries
            .sortedByDescending { it.value.score }
            .take(3)
            .map { it.key to it.value }
}

/**
 * Outcome of fetching the latest GTO result for a given test type.
 *
 * Distinguishes the three states the dashboard must render differently:
 * - [Available]: a scored result exists.
 * - [AnalysisPending]: a submission exists but has no scores yet (worker not finished, or
 *   permanently failed) — the UI must show "analysis pending" rather than silently dropping the
 *   test type.
 * - [NotAttempted]: the user has no submission for this test type.
 */
sealed interface GTOResultStatus {
    data class Available(val result: GTOResult) : GTOResultStatus
    data object AnalysisPending : GTOResultStatus
    data object NotAttempted : GTOResultStatus
}

/**
 * Thrown by the result lookup when a submission exists but has no OLQ scores in either the
 * `gto_results` collection or embedded on the submission — i.e. analysis is still pending or has
 * permanently failed. Callers map this to [GTOResultStatus.AnalysisPending] rather than treating it
 * as a generic/transient failure.
 */
class GTOAnalysisUnavailableException(submissionId: String) :
    Exception("No OLQ scores available for submission $submissionId (analysis pending or failed)")

/**
 * User's GTO progress tracking
 */
data class GTOProgress(
    val userId: String,
    val completedTests: List<GTOTestType> = emptyList(),
    val currentSequentialOrder: Int = 1, // Next test to unlock (1-8)
    val lastCompletedAt: Long? = null
) {
    /**
     * Check if a specific test is unlocked (prerequisite tests completed)
     */
    fun isTestUnlocked(testType: GTOTestType): Boolean {
        val prerequisites = GTOTestType.getPrerequisites(testType)
        return prerequisites.all { it in completedTests }
    }
    
    /**
     * Get the next available test to take
     */
    fun getNextTest(): GTOTestType? {
        return GTOTestType.fromOrder(currentSequentialOrder)
    }
    
    /**
     * Calculate overall completion percentage
     */
    val completionPercentage: Float
        get() = (completedTests.size.toFloat() / 8f) * 100f
}
