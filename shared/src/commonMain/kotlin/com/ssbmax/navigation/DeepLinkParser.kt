package com.ssbmax.navigation

/**
 * Utility for parsing and building deep links for notifications
 *
 * Deep link format: ssbmax://{route}
 * Example: ssbmax://interview/result/abc123 -> interview/result/abc123
 *
 * SINGLE SOURCE OF TRUTH for deep link schemes and routes (KMP-convergence
 * Phase 4 -- moved verbatim from `app/utils/DeepLinkParser.kt`, now true on
 * both platforms via [DeepLinkGateway] rather than Android-only).
 */
object DeepLinkParser {

    /** Deep link scheme used by SSBMax notifications */
    const val SCHEME = "ssbmax://"

    /** Route prefix for interview results */
    const val ROUTE_INTERVIEW_RESULT = "interview/result/"

    /** Route for interview history */
    const val ROUTE_INTERVIEW_HISTORY = "interview/history"

    /** Route for the notification center; mirrors [com.ssbmax.navigation.SSBMaxDestinations.NotificationCenter.route] */
    const val ROUTE_NOTIFICATION_CENTER = "notifications/center"

    // ========================
    // Deep Link Building
    // ========================

    /**
     * Build a deep link for interview result
     * @param resultId The interview result ID
     * @return Deep link string (e.g., "ssbmax://interview/result/abc123")
     */
    fun buildInterviewResultDeepLink(resultId: String): String {
        return "$SCHEME$ROUTE_INTERVIEW_RESULT$resultId"
    }

    /**
     * Build a deep link for interview history
     * @return Deep link string (e.g., "ssbmax://interview/history")
     */
    fun buildInterviewHistoryDeepLink(): String {
        return "$SCHEME$ROUTE_INTERVIEW_HISTORY"
    }

    // ========================
    // Deep Link Parsing
    // ========================

    /**
     * Parse a deep link and return the navigation route
     *
     * @param deepLink The full deep link (e.g., "ssbmax://interview/result/abc123")
     * @return The navigation route (e.g., "interview/result/abc123") or null if invalid
     */
    fun parseToRoute(deepLink: String?): String? {
        if (deepLink.isNullOrBlank()) return null

        return when {
            deepLink.startsWith(SCHEME) -> deepLink.removePrefix(SCHEME)
            // Already a route without scheme
            !deepLink.contains("://") -> deepLink
            else -> null // Unsupported scheme
        }
    }

    /**
     * Check if a deep link is an interview result link
     */
    fun isInterviewResultLink(deepLink: String?): Boolean {
        val route = parseToRoute(deepLink) ?: return false
        return route.startsWith(ROUTE_INTERVIEW_RESULT)
    }

    /**
     * Extract the result ID from an interview result deep link
     *
     * @param deepLink The deep link (e.g., "ssbmax://interview/result/abc123")
     * @return The result ID (e.g., "abc123") or null if not an interview result link
     */
    fun extractInterviewResultId(deepLink: String?): String? {
        val route = parseToRoute(deepLink) ?: return null
        if (!route.startsWith(ROUTE_INTERVIEW_RESULT)) return null
        return route.removePrefix(ROUTE_INTERVIEW_RESULT).takeIf { it.isNotBlank() }
    }
}
