package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed [TestUsageRecorder] port.
 *
 * Phase 5 (docs/plans/CrossPlatform_SSOT): this used to write
 * `users/{userId}/subscription/usage_{yyyy-MM}` directly via a client-side Firestore
 * transaction. That write path is now closed -- firestore.rules denies all client writes
 * to this path -- because a client-writable counter (even one shaped like a strict
 * increment-by-one) can always be forged by a modified client. The `recordTestUsage`
 * callable Cloud Function (functions/src/eligibility.js, Admin SDK) is now the sole
 * writer and the sole authority on whether this attempt is within quota; this class is a
 * thin RPC wrapper over it. Idempotency by submission ID and the month boundary are both
 * now server-owned (UTC, not device-local).
 *
 * A `resource-exhausted` FirebaseFunctionsException propagates to the caller exactly like
 * any other failure the old direct-write transaction could throw -- callers already treat
 * a recordTestUsage failure as recoverable (see SubmitOIRTestUseCase's step 3 comment).
 */
class GitLiveTestUsageRecorder : TestUsageRecorder {

    @Serializable
    private data class RecordTestUsageRequest(val testType: String, val submissionId: String? = null)

    override suspend fun recordTestUsage(testType: TestType, userId: String, submissionId: String?) {
        Firebase.functions
            .httpsCallable("recordTestUsage")
            .invoke(RecordTestUsageRequest(testType = testType.name, submissionId = submissionId))
    }
}
