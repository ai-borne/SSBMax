package com.ssbmax.shared.data.repository

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Characterization tests for [shouldSkipUsageRecording], the dedup decision
 * `GitLiveTestUsageRecorder.recordTestUsage` uses to keep usage counting idempotent by
 * submission id (OIR Retake Seal, Phase 2). Phase 1 made OIR mint a fresh submission id per
 * attempt, so this existing, unmodified path now dedups OIR correctly too — these tests pin
 * that behavior without a live Firestore transaction, and without any OIR-specific branch.
 */
class GitLiveTestUsageRecorderTest {

    @Test
    fun `OIR retake with a fresh submission id increments usage`() {
        val shouldSkip = shouldSkipUsageRecording(
            recordedSubmissionIds = listOf("oir-attempt-1"),
            submissionId = "oir-attempt-2"
        )

        assertFalse(shouldSkip)
    }

    @Test
    fun `OIR first attempt increments usage`() {
        val shouldSkip = shouldSkipUsageRecording(
            recordedSubmissionIds = emptyList(),
            submissionId = "oir-attempt-1"
        )

        assertFalse(shouldSkip)
    }

    @Test
    fun `a genuine retry with the same submission id does not double-count`() {
        val shouldSkip = shouldSkipUsageRecording(
            recordedSubmissionIds = listOf("oir-attempt-1"),
            submissionId = "oir-attempt-1"
        )

        assertTrue(shouldSkip)
    }
}
