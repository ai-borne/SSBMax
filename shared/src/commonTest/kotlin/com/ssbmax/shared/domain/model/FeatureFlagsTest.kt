package com.ssbmax.shared.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * [isAppVersionBelowMinimum] is Phase 8's actual gate decision -- every other
 * moving part (repository, ViewModel, screen) exists to feed it two strings
 * and act on the result, so its comparison semantics are worth pinning
 * directly rather than only indirectly through [AppRootViewModel]'s tests.
 */
class FeatureFlagsTest {

    @Test
    fun `equal versions are not below minimum`() {
        assertFalse(isAppVersionBelowMinimum(current = "1.2.3", minimum = "1.2.3"))
    }

    @Test
    fun `a higher current version is not below minimum`() {
        assertFalse(isAppVersionBelowMinimum(current = "2.0.0", minimum = "1.9.9"))
    }

    @Test
    fun `a lower current version is below minimum`() {
        assertTrue(isAppVersionBelowMinimum(current = "1.0.0", minimum = "1.0.1"))
    }

    @Test
    fun `compares numerically rather than lexicographically`() {
        // Lexicographic compare would say "9" > "10" -- a real regression class for version strings.
        assertTrue(isAppVersionBelowMinimum(current = "1.9.0", minimum = "1.10.0"))
    }

    @Test
    fun `a shorter version string is padded with zero segments`() {
        assertFalse(isAppVersionBelowMinimum(current = "1.2", minimum = "1.2.0"))
        assertTrue(isAppVersionBelowMinimum(current = "1.2", minimum = "1.2.1"))
    }

    @Test
    fun `a malformed segment is treated as zero instead of throwing`() {
        assertEquals(false, isAppVersionBelowMinimum(current = "1.x.0", minimum = "1.0.0"))
    }

    @Test
    fun `SAFE_DEFAULT carries the compiled-in contract minimum and no flags`() {
        assertEquals(
            com.ssbmax.shared.contracts.SsbContracts.Routes.MINIMUM_SUPPORTED_APP_VERSION,
            FeatureFlags.SAFE_DEFAULT.minimumSupportedAppVersion
        )
        assertTrue(FeatureFlags.SAFE_DEFAULT.flags.isEmpty())
    }

    @Test
    fun `isEnabled falls back to the caller-supplied default for an unknown flag`() {
        val flags = FeatureFlags(flags = mapOf("known" to true))

        assertTrue(flags.isEnabled("known"))
        assertFalse(flags.isEnabled("unknown"))
        assertTrue(flags.isEnabled("unknown", default = true))
    }
}
