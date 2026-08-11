package com.ssbmax.shared.presentation.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ssbmax.shared.domain.model.AppTheme
import com.ssbmax.shared.domain.model.isAppVersionBelowMinimum
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.FeatureFlagRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.currentAppVersion
import com.ssbmax.shared.platform.settings.AppThemeSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Root-level ViewModel shared by every platform entry point that renders
 * [com.ssbmax.shared.ui.SSBMaxRoot] (Android's `MainActivity`, iOS's
 * `MainViewController`). KMP port of `app/MainViewModel.kt`, moved with two
 * fixes:
 *
 * - Exposes [AppThemeSettings.themeFlow] directly instead of the original's
 *   `appThemeSettings.themeFlow.value` one-time read in `init`. That
 *   snapshot read was the actual live bug named by Phase 2 of the
 *   KMP-convergence plan: theme switching was broken on both platforms, and
 *   iOS had no theming at all since nothing collected the flow.
 * - `ErrorLogger` (Android-only) -> [DomainLogger] (commonMain).
 */
class AppRootViewModel(
    appThemeSettings: AppThemeSettings,
    private val authRepository: AuthRepository,
    private val userProfileRepository: UserProfileRepository,
    private val featureFlagRepository: FeatureFlagRepository,
    private val logger: DomainLogger
) : ViewModel() {

    val themeFlow: StateFlow<AppTheme> = appThemeSettings.themeFlow

    private val _updateRequired = MutableStateFlow(false)

    /** Phase 8 remote kill-switch: true once this build's version is confirmed below the live floor. */
    val updateRequired: StateFlow<Boolean> = _updateRequired.asStateFlow()

    init {
        updateLoginStreak()
        checkAppVersionGate()
    }

    private fun checkAppVersionGate() {
        viewModelScope.launch {
            val flags = featureFlagRepository.getFeatureFlags()
            _updateRequired.value = isAppVersionBelowMinimum(
                current = currentAppVersion(),
                minimum = flags.minimumSupportedAppVersion
            )
        }
    }

    private fun updateLoginStreak() {
        viewModelScope.launch {
            try {
                val currentUser = authRepository.currentUser.first()
                if (currentUser != null) {
                    userProfileRepository.updateLoginStreak(currentUser.id)
                }
            } catch (e: Exception) {
                // Streak update is not critical for app functionality.
                logger.e(TAG, "Failed to update login streak", e)
            }
        }
    }

    private companion object {
        const val TAG = "AppRootViewModel"
    }
}
