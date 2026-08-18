package com.ssbmax.shared.domain.model

import com.ssbmax.shared.contracts.SsbContracts

/**
 * Subscription tiers available in SSBMax
 * Pricing/limits SSOT is [SsbContracts.Pricing]/[SsbContracts.Subscription] (contracts/pricing.yaml,
 * contracts/subscription.yaml — see contracts/README.md) — this enum reads from it, it does not
 * define the numbers itself.
 *
 * Platform-independent enum - serialization handled in presentation layer
 */
enum class SubscriptionTier {
    FREE,
    BASIC,
    PRO,
    PREMIUM;

    val displayName: String
        get() = when (this) {
            FREE -> "Free"
            BASIC -> "Basic"
            PRO -> "Pro"
            PREMIUM -> "Premium"
        }

    val description: String
        get() = when (this) {
            FREE -> "Full access to study materials"
            BASIC -> "Study materials + starter practice tests"
            PRO -> "Study materials + more practice tests"
            PREMIUM -> "Unlimited tests + AI analysis + Marketplace"
        }

    val monthlyPriceInt: Int
        get() = SsbContracts.Pricing.TIERS.first { it.tier == name }.monthlyInr

    val monthlyPrice: String
        get() = "₹$monthlyPriceInt/month"

    val yearlyPrice: String?
        get() = when (this) {
            FREE -> null
            BASIC -> null
            PRO -> "₹999/year"  // ~16% savings
            PREMIUM -> "₹9,999/year" // ~17% savings
        }

    val yearlyPriceInt: Int?
        get() = when (this) {
            FREE -> null
            BASIC -> null
            PRO -> 999
            PREMIUM -> 9999
        }

    val quarterlyPrice: String?
        get() = when (this) {
            FREE -> null
            BASIC -> null
            PRO -> "₹249/quarter"  // ~16% savings
            PREMIUM -> "₹2,699/quarter" // ~10% savings
        }

    val quarterlyPriceInt: Int?
        get() = when (this) {
            FREE -> null
            BASIC -> null
            PRO -> 249
            PREMIUM -> 2699
        }

    /**
     * Check if this tier has access to overview sections
     */
    val hasOverviewAccess: Boolean
        get() = true // All tiers have overview access
    
    /**
     * Check if this tier has full access to study materials
     */
    val hasStudyMaterialsAccess: Boolean
        get() = true // All tiers have full study materials access
    
    /**
     * Check if this tier has access to practice tests
     */
    val hasTestAccess: Boolean
        get() = this != FREE

    private fun limitFor(bucket: String): Int {
        val limit = SsbContracts.Subscription.LIMITS.first { it.bucket == bucket }
        return when (this) {
            FREE -> limit.free
            BASIC -> limit.basic
            PRO -> limit.pro
            PREMIUM -> limit.premium
        }
    }
    
    /**
     * Check if this tier has AI-based test result analysis
     */
    val hasAIAnalysis: Boolean
        get() = this == PREMIUM
    
    /**
     * Check if this tier has access to SSB Marketplace
     * (online assessors and offline/physical class enrollment)
     */
    val hasMarketplaceAccess: Boolean
        get() = this == PREMIUM
    
    /**
     * Check if this tier has human assessor feedback
     */
    val hasAssessorFeedback: Boolean
        get() = this == PREMIUM
    
    /**
     * Get list of features available in this tier.
     *
     * Quota lines are generated from [SsbContracts.Subscription.LIMITS] (never hand-typed —
     * see contracts/README.md) so this list can't drift from the contract that also drives
     * [com.ssbmax.shared.data.repository.SubscriptionLimits] enforcement. Qualitative
     * (non-numeric) perks aren't in the contract and stay hand-written here.
     */
    val features: List<String>
        get() {
            val quotaLines = BUCKET_LABELS.mapNotNull { (bucket, label) ->
                when (val n = limitFor(bucket)) {
                    0 -> null
                    -1 -> "Unlimited ${label}s"
                    else -> "$n $label${if (n == 1) "" else "s"} per month"
                }
            }
            return quotaLines + qualitativeFeatures
        }

    private val qualitativeFeatures: List<String>
        get() = when (this) {
            FREE -> listOf(
                "Access to all study materials",
                "Basic progress tracking",
                "Community support"
            )
            BASIC -> listOf(
                "Access to all study materials",
                "Progress tracking",
                "Email support"
            )
            PRO -> listOf(
                "Advanced analytics",
                "Priority support",
                "Download study materials"
            )
            PREMIUM -> listOf(
                "AI-powered feedback",
                "Personalized study plans",
                "Expert mentor sessions",
                "SSB Marketplace access",
                "Premium content library",
                "Certificate of completion",
                "Lifetime access to materials"
            )
        }

    private companion object {
        val BUCKET_LABELS = listOf(
            "OIR" to "OIR test",
            "PPDT" to "PPDT test",
            "PIQ" to "PIQ form update",
            "TAT" to "TAT test",
            "WAT" to "WAT test",
            "SRT" to "SRT test",
            "SD" to "SD test",
            "GTO" to "GTO test attempt",
            "INTERVIEW" to "Interview practice"
        )
    }
}

/**
 * Billing cycle for subscriptions
 */
enum class BillingCycle {
    MONTHLY,
    QUARTERLY,
    ANNUALLY;
    
    val displayName: String
        get() = when (this) {
            MONTHLY -> "Monthly"
            QUARTERLY -> "Quarterly"
            ANNUALLY -> "Annually"
        }
}

/**
 * Subscription plan option for display in upgrade screen
 * 
 * Note: Platform-specific serialization (Parcelable, Codable, etc.) 
 * should be handled in the presentation layer if needed.
 */
data class SubscriptionPlan(
    val tier: SubscriptionTier,
    val name: String,
    val price: Int, // in rupees
    val billingPeriod: BillingPeriod,
    val features: List<String>,
    val isPopular: Boolean = false,
    val savings: Int? = null // percentage savings for annual plans
)

/**
 * Billing period for subscriptions
 */
enum class BillingPeriod(val displayName: String, val months: Int) {
    MONTHLY("Monthly", 1),
    QUARTERLY("Quarterly", 3),
    YEARLY("Yearly", 12)
}

