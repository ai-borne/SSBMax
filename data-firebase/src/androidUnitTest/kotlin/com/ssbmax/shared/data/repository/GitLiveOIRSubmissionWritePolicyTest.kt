package com.ssbmax.shared.data.repository

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Characterization tests for [isOirSubmissionIdentityConflict], the guard `submitOIR`
 * uses when a document already exists at the incoming submission id (OIR Retake Seal,
 * Phase 1 — Option B). After Phase 1, each OIR attempt mints a fresh id, so this guard
 * is only reachable on a genuine same-id retry, not a retake — these tests pin that the
 * pre-existing security guard still behaves correctly now that it's rarely exercised.
 */
class GitLiveOIRSubmissionWritePolicyTest {

    @Test
    fun `retry with the same submission id is idempotent (no conflict)`() {
        val conflict = isOirSubmissionIdentityConflict(
            existingUserId = "u1", existingTestType = "OIR",
            incomingUserId = "u1", incomingTestType = "OIR"
        )

        assertFalse(conflict)
    }

    @Test
    fun `conflicting user on a colliding id is rejected`() {
        val conflict = isOirSubmissionIdentityConflict(
            existingUserId = "u2", existingTestType = "OIR",
            incomingUserId = "u1", incomingTestType = "OIR"
        )

        assertTrue(conflict)
    }

    @Test
    fun `conflicting test type on a colliding id is rejected`() {
        val conflict = isOirSubmissionIdentityConflict(
            existingUserId = "u1", existingTestType = "PPDT",
            incomingUserId = "u1", incomingTestType = "OIR"
        )

        assertTrue(conflict)
    }
}
