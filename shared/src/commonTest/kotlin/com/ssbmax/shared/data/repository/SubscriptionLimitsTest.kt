package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Pins the FREE/PRO/PREMIUM per-test-type limit table extracted from the
 * Android SubscriptionRepositoryImpl's inlined when-blocks. Regression target:
 * a silent limit change here (e.g. FREE OIR going from 1 to 0) would let paid
 * features leak to free users or block free users from what they're entitled
 * to — exactly the kind of "fails silently" migration risk the KMP plan calls
 * out, since nothing else would catch a wrong number in this table.
 */
class SubscriptionLimitsTest {

    @Test
    fun `FREE tier matches the Android SubscriptionRepositoryImpl limits`() {
        assertEquals(1, SubscriptionLimits.limitFor("OIR", SubscriptionTier.FREE))
        assertEquals(1, SubscriptionLimits.limitFor("PPDT", SubscriptionTier.FREE))
        assertEquals(1, SubscriptionLimits.limitFor("PIQ", SubscriptionTier.FREE))
        assertEquals(0, SubscriptionLimits.limitFor("TAT", SubscriptionTier.FREE))
        assertEquals(0, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.FREE))
    }

    @Test
    fun `PRO tier matches the Android SubscriptionRepositoryImpl limits`() {
        assertEquals(5, SubscriptionLimits.limitFor("OIR", SubscriptionTier.PRO))
        assertEquals(5, SubscriptionLimits.limitFor("PPDT", SubscriptionTier.PRO))
        assertEquals(-1, SubscriptionLimits.limitFor("PIQ", SubscriptionTier.PRO))
        assertEquals(3, SubscriptionLimits.limitFor("TAT", SubscriptionTier.PRO))
        assertEquals(1, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.PRO))
    }

    @Test
    fun `PREMIUM tier is unlimited for every test type except Interview`() {
        SubscriptionLimits.testTypeKeys.filter { it != "INTERVIEW" }.forEach { key ->
            assertEquals(-1, SubscriptionLimits.limitFor(key, SubscriptionTier.PREMIUM), "expected $key unlimited for PREMIUM")
        }
    }

    /**
     * Interview is capped at 3/month even for PREMIUM — the one deliberate exception to
     * "PREMIUM is unlimited," per the interview-limits SSOT unification (was nominally
     * unlimited here while [com.ssbmax.shared.domain.model.interview.InterviewLimits] separately
     * enforced 3; this table is now the only place either number lives).
     */
    @Test
    fun `PREMIUM tier caps Interview at 3`() {
        assertEquals(3, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.PREMIUM))
    }

    @Test
    fun `unknown test type key defaults to zero not unlimited`() {
        assertEquals(0, SubscriptionLimits.limitFor("Nonexistent Test", SubscriptionTier.PREMIUM))
    }

    /**
     * Ported from the deleted `core:data` `SubscriptionManagerEdgeCasesTest`
     * (KMP-convergence Phase 9d) — every [TestType.keyFor] result must be a
     * real key in this table; a mapping to a typo'd or missing key would
     * silently fall through [limitFor]'s `?: 0` default, blocking every user
     * (including paid tiers) from a test type with no visible error.
     */
    @Test
    fun `keyFor maps every TestType to a key present in the limits table`() {
        TestType.entries.forEach { testType ->
            val key = SubscriptionLimits.keyFor(testType)
            assertTrue(key in SubscriptionLimits.testTypeKeys, "TestType.$testType mapped to unknown key '$key'")
        }
    }

    /** All 8 GTO sub-tests share one counter/limit — same grouping as the Android original. */
    @Test
    fun `all GTO sub-tests share the same limits-table key`() {
        val gtoTypes = listOf(
            TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR,
            TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT
        )
        gtoTypes.forEach { assertEquals("GTO", SubscriptionLimits.keyFor(it)) }
    }
}
