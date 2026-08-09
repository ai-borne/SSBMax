package com.ssbmax.shared.presentation.study

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.RecordVoiceOver

import androidx.compose.ui.graphics.vector.ImageVector
import com.ssbmax.shared.domain.util.DomainLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of the Android `app/.../ui/study/StudyMaterialsViewModel.kt`.
 * Study categories are currently hardcoded content (same TODO the Android
 * original carries: migrate to a Firestore-based dynamic content system).
 *
 * Uses a real `androidx.lifecycle.ViewModel` with `viewModelScope` (Phase 1 of
 * the KMP-convergence plan, see
 * [com.ssbmax.shared.presentation.oir.OIRTestViewModel]'s doc comment for the
 * precedent this mirrors). `ErrorLogger.log` (Android-only, Crashlytics-backed)
 * replaced with [DomainLogger], same seam every other ported ViewModel in
 * this phase uses.
 */
class StudyMaterialsViewModel(
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(StudyMaterialsUiState())
    val uiState: StateFlow<StudyMaterialsUiState> = _uiState.asStateFlow()

    private companion object {
        const val TAG = "StudyMaterialsViewModel"
    }

    init {
        loadCategories()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            try {
                val categories = listOf(
                    StudyCategoryItem(StudyCategory.OIR_PREP, "OIR Test Prep", Icons.Default.Quiz, 24, false),
                    StudyCategoryItem(StudyCategory.PPDT_TECHNIQUES, "PPDT Techniques", Icons.Default.Image, 18, false),
                    StudyCategoryItem(StudyCategory.PSYCHOLOGY_TESTS, "Psychology Tests", Icons.Default.Psychology, 32, true),
                    StudyCategoryItem(StudyCategory.PIQ_PREP, "PIQ Form Guide", Icons.AutoMirrored.Filled.Assignment, 15, false),
                    StudyCategoryItem(StudyCategory.GTO_TASKS, "GTO Tasks Guide", Icons.Default.Groups, 28, true),
                    StudyCategoryItem(StudyCategory.INTERVIEW_PREP, "Interview Prep", Icons.Default.RecordVoiceOver, 45, true),
                    StudyCategoryItem(StudyCategory.GENERAL_TIPS, "General SSB Tips", Icons.Default.Lightbulb, 56, false),
                    StudyCategoryItem(StudyCategory.CURRENT_AFFAIRS, "Current Affairs", Icons.Default.Public, 120, true),
                    StudyCategoryItem(StudyCategory.PHYSICAL_FITNESS, "Physical Fitness", Icons.Default.FitnessCenter, 22, false)
                )

                val totalArticles = categories.sumOf { it.articleCount }

                _uiState.value = StudyMaterialsUiState(
                    categories = categories,
                    totalArticles = totalArticles,
                    isLoading = false,
                    error = null
                )
            } catch (e: Exception) {
                logger.e(TAG, "Error loading study material categories", e)
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load study materials") }
            }
        }
    }
}

/**
 * UI State for Study Materials Screen
 */
data class StudyMaterialsUiState(
    val categories: List<StudyCategoryItem> = emptyList(),
    val totalArticles: Int = 0,
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * Study category display item. Note: this is a UI-local enum distinct from
 * [com.ssbmax.shared.domain.model.StudyCategory] (different members --
 * OIR_PREP/PIQ_PREP/PHYSICAL_FITNESS here vs. OIR_PREP/PPDT_TECH/PSYCHOLOGY
 * there) -- a pre-existing naming collision in the Android original
 * (`app/.../ui/study/StudyMaterialsScreen.kt`'s own `StudyCategory` vs.
 * `core:domain`'s), faithfully carried forward, not introduced by this port.
 */
data class StudyCategoryItem(
    val type: StudyCategory,
    val title: String,
    val icon: ImageVector,
    val articleCount: Int,
    val isPremium: Boolean
)

enum class StudyCategory {
    OIR_PREP,
    PPDT_TECHNIQUES,
    PSYCHOLOGY_TESTS,
    PIQ_PREP,
    GTO_TASKS,
    INTERVIEW_PREP,
    GENERAL_TIPS,
    CURRENT_AFFAIRS,
    PHYSICAL_FITNESS
}
