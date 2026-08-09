package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import kotlinx.serialization.Serializable

/** Wire-format DTO for users/{userId}/data/subscription. */
@Serializable
data class SubscriptionTierDto(val tier: String = "FREE") {
    fun toDomain(): SubscriptionTier = when (tier.uppercase()) {
        "PRO" -> SubscriptionTier.PRO
        "PREMIUM" -> SubscriptionTier.PREMIUM
        else -> SubscriptionTier.FREE
    }
}

/**
 * Wire-format DTO for users/{userId}/subscription/usage_{yyyy-MM}.
 *
 * `userId`/`month`/`lastUpdated` exist only to satisfy firestore.rules' `subscription/{document}`
 * create rule (`hasAll(['month', ..., 'lastUpdated'])` + `data.userId == userId`) — they aren't
 * read back anywhere (GitLiveSubscriptionRepository.getMonthlyUsage only reads the counters).
 */
@Serializable
data class SubscriptionUsageDto(
    val userId: String = "",
    val month: String = "",
    val oirTestsUsed: Int = 0,
    val ppdtTestsUsed: Int = 0,
    val piqTestsUsed: Int = 0,
    val tatTestsUsed: Int = 0,
    val watTestsUsed: Int = 0,
    val srtTestsUsed: Int = 0,
    val sdTestsUsed: Int = 0,
    val gtoTestsUsed: Int = 0,
    val interviewTestsUsed: Int = 0,
    /** Stable submission IDs already charged for this month. */
    val recordedSubmissionIds: List<String> = emptyList(),
    val lastUpdated: Long = 0
)

/**
 * Test-type usage limits by tier — the SSOT the Android SubscriptionRepositoryImpl
 * inlined as a repeated when-block per test type. Extracted here as a pure,
 * directly unit-testable table (see SubscriptionLimitsTest), matching this
 * repo's CLAUDE.md preference for testing WHY behavior matters rather than
 * re-asserting Firestore plumbing.
 */
object SubscriptionLimits {
    private val limits: Map<String, Map<SubscriptionTier, Int>> = mapOf(
        "OIR Tests" to mapOf(SubscriptionTier.FREE to 1, SubscriptionTier.PRO to 5, SubscriptionTier.PREMIUM to -1),
        "PPDT Tests" to mapOf(SubscriptionTier.FREE to 1, SubscriptionTier.PRO to 5, SubscriptionTier.PREMIUM to -1),
        "PIQ Forms" to mapOf(SubscriptionTier.FREE to 1, SubscriptionTier.PRO to -1, SubscriptionTier.PREMIUM to -1),
        "TAT Tests" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 3, SubscriptionTier.PREMIUM to -1),
        "WAT Tests" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 3, SubscriptionTier.PREMIUM to -1),
        "SRT Tests" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 3, SubscriptionTier.PREMIUM to -1),
        "Self Description" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 3, SubscriptionTier.PREMIUM to -1),
        "GTO Tests" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 3, SubscriptionTier.PREMIUM to -1),
        "Interview" to mapOf(SubscriptionTier.FREE to 0, SubscriptionTier.PRO to 1, SubscriptionTier.PREMIUM to 3)
    )

    val testTypeKeys: Set<String> get() = limits.keys

    fun limitFor(testTypeKey: String, tier: SubscriptionTier): Int =
        limits[testTypeKey]?.get(tier) ?: 0

    /**
     * Maps a [TestType] to the display-string key this table (and
     * [GitLiveSubscriptionRepository.getMonthlyUsage]'s `usedByKey` map) uses.
     * Mirrors the Android `SubscriptionManager.getTestLimitForTier`/
     * `getUsedCountForTestType` when-blocks' groupings (all 8 GTO sub-tests
     * share one "GTO Tests" bucket, same as the Android original) — added
     * for [com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase],
     * which needs to go from a [TestType] to this table's key, not just look
     * up an already-known key.
     */
    fun keyFor(testType: TestType): String = when (testType) {
        TestType.OIR -> "OIR Tests"
        TestType.PPDT -> "PPDT Tests"
        TestType.PIQ -> "PIQ Forms"
        TestType.TAT -> "TAT Tests"
        TestType.WAT -> "WAT Tests"
        TestType.SRT -> "SRT Tests"
        TestType.SD -> "Self Description"
        TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR,
        TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT -> "GTO Tests"
        TestType.IO -> "Interview"
    }
}
