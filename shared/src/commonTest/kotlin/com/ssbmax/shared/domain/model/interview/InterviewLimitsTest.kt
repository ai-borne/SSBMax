package com.ssbmax.shared.domain.model.interview

import com.ssbmax.shared.data.repository.SubscriptionLimits
import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Regression guard for the production crash: `InterviewLimits.init` used to require
 * `used + remaining == totalLimit`, which is unsatisfiable once `used` exceeds `totalLimit`
 * (remaining floors at 0). Any FREE/PRO user whose usage exceeded their tier's limit — reachable
 * once the dev subscription override lets a tester switch tiers mid-session — threw
 * `IllegalArgumentException` opening Start Interview. Also pins that `forSubscription` derives its
 * numbers from [SubscriptionLimits] (the SSOT) rather than redeclaring them, so the enforcement
 * and display tables can't silently diverge again.
 */
class InterviewLimitsTest {

    // =========================================================================
    // Crash regression: used above totalLimit must not throw, at every tier
    // =========================================================================

    @Test
    fun `used above totalLimit constructs without throwing for FREE`() {
        val limits = InterviewLimits.forSubscription(SubscriptionTier.FREE, used = 5)
        assertEquals(0, limits.totalLimit)
        assertEquals(0, limits.remaining)
    }

    @Test
    fun `used above totalLimit constructs without throwing for PRO`() {
        val limits = InterviewLimits.forSubscription(SubscriptionTier.PRO, used = 5)
        assertEquals(1, limits.totalLimit)
        assertEquals(0, limits.remaining)
    }

    @Test
    fun `used above totalLimit constructs without throwing for PREMIUM`() {
        val limits = InterviewLimits.forSubscription(SubscriptionTier.PREMIUM, used = 5)
        assertEquals(3, limits.totalLimit)
        assertEquals(0, limits.remaining)
    }

    // =========================================================================
    // forSubscription must match SubscriptionLimits.limitFor("INTERVIEW", tier) exactly
    // =========================================================================

    @Test
    fun `forSubscription totalLimit matches SubscriptionLimits table for every tier`() {
        SubscriptionTier.entries.forEach { tier ->
            val expected = SubscriptionLimits.limitFor("INTERVIEW", tier)
            val actual = InterviewLimits.forSubscription(tier, used = 0).totalLimit
            assertEquals(expected, actual, "$tier totalLimit must match SubscriptionLimits table")
        }
    }

    // =========================================================================
    // hasInterviewsRemaining boundaries
    // =========================================================================

    @Test
    fun `hasInterviewsRemaining is false when used equals limit`() {
        assertFalse(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PRO, used = 1))
        assertFalse(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PREMIUM, used = 3))
    }

    @Test
    fun `hasInterviewsRemaining is false when used exceeds limit`() {
        assertFalse(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PRO, used = 2))
        assertFalse(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PREMIUM, used = 4))
    }

    @Test
    fun `hasInterviewsRemaining is true just under the limit`() {
        assertTrue(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PRO, used = 0))
        assertTrue(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.PREMIUM, used = 2))
    }

    @Test
    fun `FREE tier has zero interviews remaining even when unused`() {
        assertFalse(InterviewLimits.hasInterviewsRemaining(SubscriptionTier.FREE, used = 0))
    }
}
