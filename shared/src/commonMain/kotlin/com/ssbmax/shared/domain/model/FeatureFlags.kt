package com.ssbmax.shared.domain.model

import com.ssbmax.shared.contracts.SsbContracts

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch payload -- read from
 * `feature_flags/config` at launch by every platform, cached with
 * [SAFE_DEFAULT] so a Firestore outage never blocks a user (fail-open, not
 * fail-closed: an indie developer cannot remotely *lock everyone out* by
 * accident, only remotely *raise the floor*).
 */
data class FeatureFlags(
    val minimumSupportedAppVersion: String = SsbContracts.Routes.MINIMUM_SUPPORTED_APP_VERSION,
    val flags: Map<String, Boolean> = emptyMap()
) {
    fun isEnabled(name: String, default: Boolean = false): Boolean = flags[name] ?: default

    companion object {
        /**
         * Fail-open fallback: the version baked into this build at compile
         * time (contracts/routes.yaml), used whenever the live Firestore doc
         * is unreachable or missing. Never blocks on its own.
         */
        val SAFE_DEFAULT = FeatureFlags()
    }
}

/**
 * Compares dotted major.minor.patch version strings (e.g. "1.2.10" > "1.2.9",
 * ordinary numeric compare per segment, not lexicographic). Missing or
 * non-numeric segments are treated as 0, so a malformed version string can
 * never throw -- it just compares as if that segment were absent.
 */
fun isAppVersionBelowMinimum(current: String, minimum: String): Boolean {
    val currentParts = current.split(".").map { it.toIntOrNull() ?: 0 }
    val minParts = minimum.split(".").map { it.toIntOrNull() ?: 0 }
    for (i in 0 until maxOf(currentParts.size, minParts.size)) {
        val c = currentParts.getOrElse(i) { 0 }
        val m = minParts.getOrElse(i) { 0 }
        if (c != m) return c < m
    }
    return false
}
