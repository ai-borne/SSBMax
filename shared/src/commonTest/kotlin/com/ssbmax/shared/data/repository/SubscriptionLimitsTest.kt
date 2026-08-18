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
    fun `BASIC tier matches the pricing-restructure monotonic limits`() {
        assertEquals(5, SubscriptionLimits.limitFor("OIR", SubscriptionTier.BASIC))
        assertEquals(5, SubscriptionLimits.limitFor("PPDT", SubscriptionTier.BASIC))
        assertEquals(5, SubscriptionLimits.limitFor("PIQ", SubscriptionTier.BASIC))
        assertEquals(5, SubscriptionLimits.limitFor("TAT", SubscriptionTier.BASIC))
        assertEquals(1, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.BASIC))
    }

    @Test
    fun `PRO tier matches the pricing-restructure monotonic limits`() {
        assertEquals(8, SubscriptionLimits.limitFor("OIR", SubscriptionTier.PRO))
        assertEquals(8, SubscriptionLimits.limitFor("PPDT", SubscriptionTier.PRO))
        assertEquals(8, SubscriptionLimits.limitFor("PIQ", SubscriptionTier.PRO))
        assertEquals(8, SubscriptionLimits.limitFor("TAT", SubscriptionTier.PRO))
        assertEquals(3, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.PRO))
    }

    /**
     * PREMIUM is capped, not unlimited, everywhere except PIQ -- the pricing restructure
     * replaced the old "-1 everywhere but Interview" model with explicit per-bucket caps
     * (OIR/PPDT/TAT/WAT/SRT/SD/GTO -> 15, INTERVIEW -> 10) so usage stays boundable.
     */
    @Test
    fun `PREMIUM tier caps every bucket except PIQ`() {
        SubscriptionLimits.testTypeKeys.filter { it != "PIQ" && it != "INTERVIEW" }.forEach { key ->
            assertEquals(15, SubscriptionLimits.limitFor(key, SubscriptionTier.PREMIUM), "expected $key capped at 15 for PREMIUM")
        }
        assertEquals(-1, SubscriptionLimits.limitFor("PIQ", SubscriptionTier.PREMIUM))
    }

    /**
     * Interview is capped at 10/month even for PREMIUM -- the one deliberate exception to
     * "PREMIUM is (near-)unlimited," per the interview-limits SSOT unification (this table
     * is the only place either number lives; see [com.ssbmax.shared.domain.model.interview.InterviewLimits]).
     */
    @Test
    fun `PREMIUM tier caps Interview at 10`() {
        assertEquals(10, SubscriptionLimits.limitFor("INTERVIEW", SubscriptionTier.PREMIUM))
    }

    @Test
    fun `limits are monotonic non-decreasing across FREE, BASIC, PRO, PREMIUM for every bucket`() {
        SubscriptionLimits.testTypeKeys.forEach { key ->
            val free = SubscriptionLimits.limitFor(key, SubscriptionTier.FREE)
            val basic = SubscriptionLimits.limitFor(key, SubscriptionTier.BASIC)
            val pro = SubscriptionLimits.limitFor(key, SubscriptionTier.PRO)
            val premium = SubscriptionLimits.limitFor(key, SubscriptionTier.PREMIUM)
            // -1 means unlimited -- always the ceiling regardless of numeric ordering.
            fun rank(n: Int) = if (n == -1) Int.MAX_VALUE else n
            assertTrue(rank(free) <= rank(basic), "$key: FREE ($free) > BASIC ($basic)")
            assertTrue(rank(basic) <= rank(pro), "$key: BASIC ($basic) > PRO ($pro)")
            assertTrue(rank(pro) <= rank(premium), "$key: PRO ($pro) > PREMIUM ($premium)")
        }
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
