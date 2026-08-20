package com.ssbmax.shared.platform.settings

import com.russhwolf.settings.Settings
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Dev-only tier override + interview-prerequisite bypass, read live (never
 * cached) by `data-firebase`'s debug decorators so toggling takes effect
 * without an app restart. Visibility is gated by `isDebugBuild()` at the
 * Koin binding site, not here -- this class stays plain and testable.
 */
class DeveloperSettings(private val settings: Settings) {

    private val _overrideFlow = MutableStateFlow(getOverride())
    val overrideFlow: StateFlow<SubscriptionOverride> = _overrideFlow.asStateFlow()

    private val _bypassInterviewPrerequisitesFlow = MutableStateFlow(getBypassInterviewPrerequisites())
    val bypassInterviewPrerequisitesFlow: StateFlow<Boolean> = _bypassInterviewPrerequisitesFlow.asStateFlow()

    fun getOverride(): SubscriptionOverride {
        val name = settings.getStringOrNull(KEY_OVERRIDE) ?: SubscriptionOverride.FOLLOW_REAL.name
        return try {
            SubscriptionOverride.valueOf(name)
        } catch (e: IllegalArgumentException) {
            SubscriptionOverride.FOLLOW_REAL
        }
    }

    fun setOverride(override: SubscriptionOverride) {
        settings.putString(KEY_OVERRIDE, override.name)
        _overrideFlow.value = override
    }

    fun getBypassInterviewPrerequisites(): Boolean =
        settings.getBoolean(KEY_BYPASS_INTERVIEW_PREREQUISITES, false)

    fun setBypassInterviewPrerequisites(bypass: Boolean) {
        settings.putBoolean(KEY_BYPASS_INTERVIEW_PREREQUISITES, bypass)
        _bypassInterviewPrerequisitesFlow.value = bypass
    }

    /** Null means "don't override" -- callers should fall through to the real tier lookup. */
    fun currentOverrideTierOrNull(): SubscriptionTier? = when (getOverride()) {
        SubscriptionOverride.FOLLOW_REAL -> null
        SubscriptionOverride.FORCE_FREE -> SubscriptionTier.FREE
        SubscriptionOverride.FORCE_BASIC -> SubscriptionTier.BASIC
        SubscriptionOverride.FORCE_PRO -> SubscriptionTier.PRO
        SubscriptionOverride.FORCE_PREMIUM -> SubscriptionTier.PREMIUM
    }

    private companion object {
        const val KEY_OVERRIDE = "developer_subscription_override"
        const val KEY_BYPASS_INTERVIEW_PREREQUISITES = "developer_bypass_interview_prerequisites"
    }
}
