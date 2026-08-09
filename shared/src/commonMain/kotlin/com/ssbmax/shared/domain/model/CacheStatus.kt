package com.ssbmax.shared.domain.model

/**
 * Cache status data class
 * Provides statistics about cached OIR questions
 */
data class CacheStatus(
    val cachedQuestions: Int,
    val batchesDownloaded: Int,
    val lastSyncTime: Long?,
    val verbalCount: Int,
    val nonVerbalCount: Int,
    val numericalCount: Int,
    val spatialCount: Int,
    val readiness: OIRCacheReadiness = OIRCacheReadiness.NOT_INITIALIZED,
    val expectedBatches: Int = 0,
    val lastError: String? = null
)

enum class OIRCacheReadiness {
    NOT_INITIALIZED,
    METADATA_UNAVAILABLE,
    SYNCING,
    READY,
    INSUFFICIENT_CONTENT,
    FAILED
}
