package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn

/**
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): pins the billing-anniversary
 * period-key algorithm that must stay byte-for-byte identical across KMP/`eligibility.js`/web --
 * a divergence here means a client shows a stale "remaining tests" count before syncing with the
 * server, which is the real gate at submission time.
 */
class BillingPeriodTest {

    private fun epochMillisUtc(date: LocalDate): Long =
        date.atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds()

    @Test
    fun `FREE tier always uses the legacy calendar-month key regardless of startDate`() {
        val key = currentPeriodKey(
            SubscriptionTier.FREE,
            epochMillisUtc(LocalDate(2026, 1, 25)),
            now = LocalDate(2026, 8, 10)
        )
        assertEquals("2026-08", key)
    }

    @Test
    fun `null startDate falls back to the calendar-month key`() {
        val key = currentPeriodKey(SubscriptionTier.PRO, null, now = LocalDate(2026, 8, 10))
        assertEquals("2026-08", key)
    }

    @Test
    fun `paid tier resets on the anniversary day not the 1st`() {
        val startDate = epochMillisUtc(LocalDate(2026, 6, 25))
        // Same month, on or after the anniversary day -- current period started this month.
        assertEquals("2026-08-25", currentPeriodKey(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 8, 25)))
        assertEquals("2026-08-25", currentPeriodKey(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 8, 30)))
        // Before the anniversary day -- still in last month's period.
        assertEquals("2026-07-25", currentPeriodKey(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 8, 24)))
    }

    @Test
    fun `a day-31 anchor clamps to Feb 28 in a non-leap year and Feb 29 in a leap year`() {
        val startDate = epochMillisUtc(LocalDate(2026, 1, 31))
        assertEquals("2026-02-28", currentPeriodKey(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 2, 28)))
        val leapYearStart = epochMillisUtc(LocalDate(2028, 1, 31))
        assertEquals("2028-02-29", currentPeriodKey(SubscriptionTier.PREMIUM, leapYearStart, now = LocalDate(2028, 2, 29)))
    }

    @Test
    fun `nextPeriodBoundary walks forward to next months anchor once the current one has passed`() {
        val startDate = epochMillisUtc(LocalDate(2026, 6, 25))
        assertEquals(LocalDate(2026, 8, 25), nextPeriodBoundary(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 8, 24)))
        assertEquals(LocalDate(2026, 9, 25), nextPeriodBoundary(SubscriptionTier.PRO, startDate, now = LocalDate(2026, 8, 25)))
    }

    @Test
    fun `nextPeriodBoundary for FREE tier is always the 1st of next calendar month`() {
        assertEquals(LocalDate(2026, 9, 1), nextPeriodBoundary(SubscriptionTier.FREE, null, now = LocalDate(2026, 8, 15)))
        assertEquals(LocalDate(2027, 1, 1), nextPeriodBoundary(SubscriptionTier.FREE, null, now = LocalDate(2026, 12, 15)))
    }

    @Test
    fun `daysInMonth handles leap years and short months`() {
        assertEquals(31, daysInMonth(2026, 1))
        assertEquals(28, daysInMonth(2026, 2))
        assertEquals(29, daysInMonth(2028, 2)) // leap year
        assertEquals(30, daysInMonth(2026, 4))
    }
}
