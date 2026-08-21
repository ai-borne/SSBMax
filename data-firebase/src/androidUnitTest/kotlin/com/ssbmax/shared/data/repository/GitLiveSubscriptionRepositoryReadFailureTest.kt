package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.util.DomainLogger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * L2 (Payment Ecosystem Hardening plan, Phase 12): before this fix, [GitLiveSubscriptionRepository]
 * .getSubscriptionTier swallowed every read exception into `Result.success(FREE)` -- the exact
 * same value a genuinely free user's read returns, with nothing to tell the two apart. These tests
 * pin [subscriptionReadFailureFallback] (the extracted, Firestore-free piece of that catch block)
 * so the distinction is provable without standing up a real/mocked Firestore.
 */
class GitLiveSubscriptionRepositoryReadFailureTest {

    private class RecordingLogger : DomainLogger {
        val errors = mutableListOf<Triple<String, String, Throwable?>>()
        override fun d(tag: String, message: String) {}
        override fun e(tag: String, message: String, throwable: Throwable?) {
            errors.add(Triple(tag, message, throwable))
        }
        override fun w(tag: String, message: String) {}
        override fun i(tag: String, message: String) {}
        override fun v(tag: String, message: String) {}
    }

    @Test
    fun `a read failure still resolves to FREE (fail-open preserved)`() {
        val logger = RecordingLogger()
        val result = subscriptionReadFailureFallback(logger, "user-1", RuntimeException("boom"))

        assertEquals(SubscriptionTier.FREE, result)
    }

    @Test
    fun `a read failure is logged distinctly, unlike a genuine free user`() {
        val logger = RecordingLogger()
        val failure = RuntimeException("Firestore offline")

        subscriptionReadFailureFallback(logger, "user-1", failure)

        assertEquals(1, logger.errors.size)
        val (tag, message, throwable) = logger.errors.single()
        assertEquals("GitLiveSubscriptionRepository", tag)
        assertTrue("log message must name the affected user", message.contains("user-1"))
        assertEquals(failure, throwable)
    }
}
