package com.ssbmax.shared.domain.usecase.subscription

import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.time.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/**
 * e.g. "Aug 1, 2026" -- first day of next calendar month. Extracted (dev-subscription-override
 * plan's Phase 10) out of [CheckTestEligibilityUseCase] so it and
 * [com.ssbmax.shared.domain.usecase.CheckInterviewPrerequisitesUseCase] compute
 * `TestEligibility.LimitReached.resetsAt` identically instead of redeclaring the same format twice.
 */
internal fun nextMonthResetLabel(): String {
    val today = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date
    val todayMonthNumber = today.month.ordinal + 1
    val nextMonthFirst = if (todayMonthNumber == 12) {
        LocalDate(today.year + 1, 1, 1)
    } else {
        LocalDate(today.year, todayMonthNumber + 1, 1)
    }
    val monthName = MONTH_NAMES[nextMonthFirst.month.ordinal]
    return "$monthName 1, ${nextMonthFirst.year}"
}

/**
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): billing-anniversary-aware
 * reset label used by [CheckTestEligibilityUseCase], which now keys usage by [currentPeriodKey]
 * instead of the flat calendar month. FREE tier / no `startDate` yet falls back to
 * [nextMonthResetLabel] unchanged -- `CheckInterviewPrerequisitesUseCase`'s interview limit is a
 * separate, non-monthly counting scheme and intentionally keeps calling [nextMonthResetLabel]
 * directly rather than this function.
 */
internal fun nextResetLabel(tier: SubscriptionTier, startDate: Long?): String {
    if (tier == SubscriptionTier.FREE || startDate == null || startDate <= 0L) {
        return nextMonthResetLabel()
    }
    val next = nextPeriodBoundary(tier, startDate)
    return "${MONTH_NAMES[next.month.ordinal]} ${next.day}, ${next.year}"
}

private val MONTH_NAMES = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
)
