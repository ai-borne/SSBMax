package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.time.Clock
import kotlin.time.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/**
 * Billing-anniversary period key (Phase 3, `docs/plans/SubscriptionPricingRestructure.md` step 5).
 *
 * Usage docs used to be keyed by global calendar month (`usage_2026-08`), so a user who
 * subscribed on the 25th only got 5 days before their first reset. A paid-tier user with a
 * known [SubscriptionTierDto.startDate][com.ssbmax.shared.data.repository.SubscriptionTierDto]
 * now resets on that day-of-month instead (`usage_2026-08-25`), clamped for short months (e.g.
 * a Jan 31 start resets on Feb 28/29). FREE tier never has a `startDate` (no purchase), so it
 * keeps the legacy calendar-month key -- this was flagged as a deliberate fallback in the plan
 * doc rather than something to re-litigate here.
 *
 * All computation is in UTC, matching `functions/src/eligibility.js`'s "server owns the month
 * boundary" comment -- the three platforms (this file, `eligibility.js`, web's
 * `subscriptionEligibility.ts`) must compute an identical key or clients show stale "remaining
 * tests" before syncing with the server, which is the actual authority at submission time.
 */
internal fun currentPeriodKey(tier: SubscriptionTier, startDate: Long?, now: LocalDate = todayUtc()): String {
    if (tier == SubscriptionTier.FREE || startDate == null || startDate <= 0L) {
        return legacyYearMonthKey(now)
    }
    val anchorDay = utcDate(startDate).day
    var year = now.year
    var month = now.month.ordinal + 1
    var clampedDay = minOf(anchorDay, daysInMonth(year, month))
    if (now.day < clampedDay) {
        month -= 1
        if (month == 0) {
            month = 12
            year -= 1
        }
        clampedDay = minOf(anchorDay, daysInMonth(year, month))
    }
    return "$year-${month.pad2()}-${clampedDay.pad2()}"
}

/**
 * The next reset date as a [LocalDate] -- for [nextResetLabel] to format for display. Mirrors
 * [currentPeriodKey]'s clamping logic but walks forward instead of back.
 */
internal fun nextPeriodBoundary(tier: SubscriptionTier, startDate: Long?, now: LocalDate = todayUtc()): LocalDate {
    if (tier == SubscriptionTier.FREE || startDate == null || startDate <= 0L) {
        return if (now.month.ordinal + 1 == 12) {
            LocalDate(now.year + 1, 1, 1)
        } else {
            LocalDate(now.year, now.month.ordinal + 2, 1)
        }
    }
    val anchorDay = utcDate(startDate).day
    var year = now.year
    var month = now.month.ordinal + 1
    var clampedDay = minOf(anchorDay, daysInMonth(year, month))
    if (now.day >= clampedDay) {
        month += 1
        if (month == 13) {
            month = 1
            year += 1
        }
        clampedDay = minOf(anchorDay, daysInMonth(year, month))
    }
    return LocalDate(year, month, clampedDay)
}

internal fun daysInMonth(year: Int, month: Int): Int = when (month) {
    1, 3, 5, 7, 8, 10, 12 -> 31
    4, 6, 9, 11 -> 30
    2 -> if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) 29 else 28
    else -> 30
}

private fun todayUtc(): LocalDate = Clock.System.now().toLocalDateTime(TimeZone.UTC).date

private fun utcDate(epochMillis: Long): LocalDate =
    Instant.fromEpochMilliseconds(epochMillis).toLocalDateTime(TimeZone.UTC).date

private fun legacyYearMonthKey(date: LocalDate): String = "${date.year}-${(date.month.ordinal + 1).pad2()}"

private fun Int.pad2(): String = toString().padStart(2, '0')
