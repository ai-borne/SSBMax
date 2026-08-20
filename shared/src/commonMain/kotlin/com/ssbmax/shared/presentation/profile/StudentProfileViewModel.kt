package com.ssbmax.shared.presentation.profile

import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.TestProgressRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.settings.DeveloperSettings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of the Android `app/.../ui/profile/StudentProfileViewModel.kt`.
 *
 * Phase 1 of the KMP-convergence plan: a real `androidx.lifecycle.ViewModel`
 * using `viewModelScope`, converged with `app`'s existing ViewModel idiom and
 * this module's own DI (`viewModelOf`) / screen (`koinViewModel()`)
 * conventions — no more manual `CoroutineScope` + `close()`.
 *
 * Deviation from the Android original: `android.util.Log` replaced with
 * [DomainLogger]. Achievements/recent-tests/study-hours/streak are still the
 * same `TODO`-stubbed placeholders (empty list / 0) as the Android original —
 * not a gap introduced by this port.
 */
class StudentProfileViewModel(
    private val userProfileRepository: UserProfileRepository,
    private val testProgressRepository: TestProgressRepository,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val developerSettings: DeveloperSettings,
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(StudentProfileUiState())
    val uiState: StateFlow<StudentProfileUiState> = _uiState.asStateFlow()

    private companion object {
        const val TAG = "StudentProfileViewModel"
    }

    init {
        observeUserProfile()
    }

    private fun observeUserProfile() {
        viewModelScope.launch {
            combine(observeCurrentUser(), developerSettings.overrideFlow) { user, _ -> user }
                .collect { user -> loadUserProfileFor(user) }
        }
    }

    private suspend fun loadUserProfileFor(currentUser: SSBMaxUser?) {
        _uiState.update { it.copy(isLoading = true, error = null) }

        try {
            if (currentUser == null) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Please login to view your profile"
                    )
                }
                return
            }

            val profileResult = userProfileRepository.getUserProfile(currentUser.id).first()
            val userProfile = profileResult.getOrNull()
            val subscriptionTier = getSubscriptionTier(currentUser.id).getOrDefault(SubscriptionTier.FREE)

            val phase1Progress = testProgressRepository.getPhase1Progress(currentUser.id).first()
            val phase2Progress = testProgressRepository.getPhase2Progress(currentUser.id).first()

            val testsWithScores = listOfNotNull(
                phase1Progress.oirProgress.latestScore,
                phase1Progress.ppdtProgress.latestScore,
                phase2Progress.psychologyProgress.latestScore,
                phase2Progress.gtoProgress.latestScore,
                phase2Progress.interviewProgress.latestScore
            )

            val totalTestsAttempted = testsWithScores.size
            val averageScore = if (testsWithScores.isNotEmpty()) {
                testsWithScores.average().toFloat()
            } else {
                0f
            }

            val phase1Completion = (if (phase1Progress.oirProgress.latestScore != null) 50 else 0) +
                (if (phase1Progress.ppdtProgress.latestScore != null) 50 else 0)

            val phase2Tests = listOf(
                phase2Progress.psychologyProgress,
                phase2Progress.gtoProgress,
                phase2Progress.interviewProgress
            )
            val phase2Completion = (phase2Tests.count { it.latestScore != null } * 33).coerceAtMost(100)

            _uiState.value = StudentProfileUiState(
                userName = userProfile?.fullName ?: currentUser.displayName,
                userEmail = userProfile?.userId ?: currentUser.email,
                photoUrl = userProfile?.profilePictureUrl ?: currentUser.photoUrl,
                isPremium = subscriptionTier == SubscriptionTier.PREMIUM,
                totalTestsAttempted = totalTestsAttempted,
                totalStudyHours = 0,
                streakDays = 0,
                averageScore = averageScore,
                phase1Completion = phase1Completion,
                phase2Completion = phase2Completion,
                recentAchievements = emptyList(),
                recentTests = emptyList(),
                isLoading = false,
                error = null
            )
        } catch (e: Exception) {
            logger.e(TAG, "Error loading profile", e)
            _uiState.update {
                it.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load profile"
                )
            }
        }
    }
}

/**
 * UI State for Student Profile Screen
 */
data class StudentProfileUiState(
    val userName: String = "",
    val userEmail: String = "",
    val photoUrl: String? = null,
    val isPremium: Boolean = false,
    val totalTestsAttempted: Int = 0,
    val totalStudyHours: Int = 0,
    val streakDays: Int = 0,
    val averageScore: Float = 0f,
    val phase1Completion: Int = 0,
    val phase2Completion: Int = 0,
    val recentAchievements: List<String> = emptyList(),
    val recentTests: List<RecentTest> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * A single recent-test row for [StudentProfileUiState.recentTests].
 */
data class RecentTest(
    val name: String,
    val date: String,
    val score: Int
)
