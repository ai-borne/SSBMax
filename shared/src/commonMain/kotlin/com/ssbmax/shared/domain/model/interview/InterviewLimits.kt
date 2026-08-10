package com.ssbmax.shared.domain.model.interview

import com.ssbmax.shared.data.repository.SubscriptionLimits
import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * TTS service type available based on subscription tier
 */
enum class TTSServiceType {
    ANDROID,      // Free tier - built-in Android TTS (ultimate fallback)
    QWEN_TTS      // Pro/Premium tier - Qwen TTS via Hugging Face (premium)
}

/**
 * Interview limits for unified interview system (TTS-based subscriptions)
 *
 * New model after removing text-based interview:
 * - All interviews use the same unified implementation
 * - Subscription tier determines TTS quality and monthly limit
 * - `totalLimit` is derived from [SubscriptionLimits] (the "Interview" row) — this class
 *   redeclares no numbers of its own, so the enforcement and display tables can't diverge again.
 *
 * @param subscriptionType User's subscription tier
 * @param totalLimit Total interviews allowed per month; -1 means unlimited
 * @param used Number of interviews used this month
 * @param remaining Interviews remaining this month
 * @param ttsService TTS service provided for this tier
 */
data class InterviewLimits(
    val subscriptionType: SubscriptionTier,
    val totalLimit: Int,
    val used: Int,
    val remaining: Int,
    val ttsService: TTSServiceType
) {
    init {
        require(totalLimit >= -1) { "Total limit must be non-negative or -1 (unlimited)" }
        require(used >= 0) { "Used count cannot be negative" }
        require(remaining >= 0) { "Remaining count cannot be negative" }
    }

    companion object {
        /**
         * Get interview limits for a subscription tier.
         *
         * @param subscriptionType User's subscription tier
         * @param used Number of interviews already used this month
         * @return InterviewLimits with tier-specific values, sourced from [SubscriptionLimits]
         */
        fun forSubscription(subscriptionType: SubscriptionTier, used: Int): InterviewLimits {
            val totalLimit = SubscriptionLimits.limitFor("INTERVIEW", subscriptionType)
            val remaining = if (totalLimit < 0) Int.MAX_VALUE else maxOf(0, totalLimit - used)
            return InterviewLimits(
                subscriptionType = subscriptionType,
                totalLimit = totalLimit,
                used = used,
                remaining = remaining,
                ttsService = getTTSService(subscriptionType)
            )
        }

        /**
         * Check if user has interviews remaining
         */
        fun hasInterviewsRemaining(subscriptionType: SubscriptionTier, used: Int): Boolean {
            return forSubscription(subscriptionType, used).remaining > 0
        }

        /**
         * Get TTS service type for subscription tier
         */
        fun getTTSService(subscriptionType: SubscriptionTier): TTSServiceType {
            return when (subscriptionType) {
                SubscriptionTier.FREE -> TTSServiceType.ANDROID
                SubscriptionTier.PRO, SubscriptionTier.PREMIUM -> TTSServiceType.QWEN_TTS
            }
        }
    }

    /**
     * Check if user can start a new interview
     */
    fun canStartInterview(): Boolean = remaining > 0

    /**
     * Get percentage of limit used (0-100)
     */
    fun getUsagePercentage(): Int {
        if (totalLimit <= 0) return 0
        return ((used.toFloat() / totalLimit) * 100).toInt()
    }

    /**
     * Get display string for TTS service
     */
    fun getTTSDisplayName(): String {
        return when (ttsService) {
            TTSServiceType.ANDROID -> "Standard Voice"
            TTSServiceType.QWEN_TTS -> "Premium AI Voice"
        }
    }
}
