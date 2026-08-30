package com.ssbmax.shared.domain.config

/**
 * Feature flags for content delivery
 * 
 * Migration complete - all 9 topics migrated to Firestore and flags permanently enabled.
 * Query methods retained as they are used by content loading logic throughout the app.
 *
 * All properties are immutable (val) since migration is complete and flags are permanent.
 *
 * The structured-content-renderer rollout flags (`isStructuredRenderingEnabled` /
 * `isStructuredStudyMaterialRenderingEnabled`, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) were removed here in the Phase 8 sweep: all 9 topics
 * had reached parity with web's equivalent (now-deleted) `contentFeatureFlags.ts`, so the
 * per-topic allowlists were dead weight. Callers now always attempt the structured path,
 * falling back to markdown only on a genuine missing/failed fetch -- the resilience path, not a
 * rollout gate.
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

