package com.ssbmax.shared.domain.config

/**
 * Feature flags for content delivery
 * 
 * Migration complete - all 9 topics migrated to Firestore and flags permanently enabled.
 * Query methods retained as they are used by content loading logic throughout the app.
 * 
 * All properties are immutable (val) since migration is complete and flags are permanent.
 */
object ContentFeatureFlags {
    // Master switch: Enable/disable cloud content
    // Migration complete - flags permanently enabled
    val useCloudContent: Boolean = true
    
    // Always fallback to local on errors (safety net)
    val fallbackToLocalOnError: Boolean = true
    
    // Per-topic rollout flags
    // ALL 9 TOPICS ENABLED - 100% FIRESTORE MIGRATION COMPLETE! 🎉
    private val topicFlags = mapOf<String, Boolean>(
        "OIR" to true,
        "PPDT" to true,
        "PSYCHOLOGY" to true,
        "PIQ_FORM" to true,
        "GTO" to true,
        "INTERVIEW" to true,
        "SSB_OVERVIEW" to true,
        "MEDICALS" to true,
        "CONFERENCE" to true
    )
    
    /**
     * Check if cloud content is enabled for a specific topic
     * Case-insensitive to handle navigation inconsistencies
     * 
     * Note: All topics permanently enabled after migration completion
     */
    fun isTopicCloudEnabled(topicType: String): Boolean {
        if (!useCloudContent) return false
        // Normalize to uppercase for consistent lookup
        return topicFlags[topicType.uppercase()] ?: false
    }
    
    // Query optimization flags
    val enableOfflinePersistence: Boolean = true
    val cacheExpiryDays: Int = 7

    /**
     * Rollout flag for the structured-content renderer (Phase 2, docs/plans/
     * write-the-phased-plan-wobbly-pancake.md) -- separate from [topicFlags] above, which
     * gates cloud-vs-local *content source*, not *rendering shape*. Web's twin is
     * `isStructuredRenderingEnabled` in `web/src/constants/contentFeatureFlags.ts`; a topic
     * enabled on one platform and not the other is a visible diff between the two maps rather
     * than a silent behavioral fork. OIR is the pilot (both here and on web) with a generated
     * [com.ssbmax.shared.ui.content.blocks.DocumentModel] today -- see
     * `TopicIntroOirStructured.kt`. NOT `SSB_OVERVIEW`: that topic ID navigates to a bespoke
     * `SSBOverviewScreen`/`SSBContentProvider` accordion UI on KMP (see `StudyContentGraph.kt`),
     * never `TopicScreen`/`IntroductionTab` at all -- wiring it there first was a real bug the
     * Phase 2 three-surface parity gate caught (Android showed the untouched accordion, not
     * this renderer).
     */
    private val structuredRenderingTopics = setOf("OIR")

    fun isStructuredRenderingEnabled(topicType: String): Boolean =
        structuredRenderingTopics.contains(topicType.uppercase())
    
    /**
     * Get current configuration as string (for debugging)
     */
    fun getStatus(): String {
        return """
            Cloud Content: ${if (useCloudContent) "ENABLED" else "DISABLED"}
            Fallback to Local: ${if (fallbackToLocalOnError) "ENABLED" else "DISABLED"}
            Offline Persistence: ${if (enableOfflinePersistence) "ENABLED" else "DISABLED"}
            Cache Expiry: $cacheExpiryDays days
            Enabled Topics: ${topicFlags.filter { it.value }.keys.joinToString(", ")}
        """.trimIndent()
    }
}

