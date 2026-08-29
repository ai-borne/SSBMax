package com.ssbmax.shared.presentation.studenttests

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.ui.graphics.vector.ImageVector
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestProgressRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of the Android `app/.../ui/tests/StudentTestsViewModel.kt`.
 * Fetches Phase 1/2 test progress from [TestProgressRepository] and maps it
 * into the flat [TestOverviewItem] list the "All Tests" screen displays.
 *
 * Uses a real `androidx.lifecycle.ViewModel` with `viewModelScope` (Phase 1 of
 * the KMP-convergence plan, see
 * [com.ssbmax.shared.presentation.oir.OIRTestViewModel]'s doc comment for the
 * precedent this mirrors). `ErrorLogger.log` (Android-only, Crashlytics-backed)
 * replaced with [DomainLogger], same seam every other ported ViewModel in
 * this phase uses.
 */
class StudentTestsViewModel(
    private val testProgressRepository: TestProgressRepository,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(StudentTestsUiState())
    val uiState: StateFlow<StudentTestsUiState> = _uiState.asStateFlow()

    private companion object {
        const val TAG = "StudentTestsViewModel"
    }

    init {
        loadAllTests()
    }

    private fun loadAllTests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val currentUser = observeCurrentUser().first()
                val userId = currentUser?.id

                if (userId == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Please login to view your tests") }
                    return@launch
                }

                val phase1Progress = testProgressRepository.getPhase1Progress(userId).first()
                val phase2Progress = testProgressRepository.getPhase2Progress(userId).first()

                val phase1Tests = listOf(
                    TestOverviewItem(
                        type = TestType.OIR,
                        name = "OIR Test",
                        icon = Icons.Default.Quiz,
                        category = "Screening",
                        durationMinutes = 40,
                        questionCount = 50,
                        status = phase1Progress.oirProgress.status,
                        latestScore = phase1Progress.oirProgress.latestScore
                    ),
                    TestOverviewItem(
                        type = TestType.PPDT,
                        name = "PPDT",
                        icon = Icons.Default.Image,
                        category = "Screening",
                        durationMinutes = 30,
                        questionCount = 1,
                        status = phase1Progress.ppdtProgress.status,
                        latestScore = phase1Progress.ppdtProgress.latestScore
                    )
                )

                val phase2Tests = listOf(
                    TestOverviewItem(TestType.TAT, "TAT", Icons.Default.EditNote, "Psychology", 30, 12, phase2Progress.psychologyProgress.status, phase2Progress.psychologyProgress.latestScore),
                    TestOverviewItem(TestType.WAT, "WAT", Icons.Default.EditNote, "Psychology", 15, 60, phase2Progress.psychologyProgress.status, phase2Progress.psychologyProgress.latestScore),
                    TestOverviewItem(TestType.SRT, "SRT", Icons.Default.EditNote, "Psychology", 30, 60, phase2Progress.psychologyProgress.status, phase2Progress.psychologyProgress.latestScore),
                    TestOverviewItem(TestType.SD, "Self Description", Icons.Default.EditNote, "Psychology", 15, 5, phase2Progress.psychologyProgress.status, phase2Progress.psychologyProgress.latestScore),
                    TestOverviewItem(TestType.GTO_GD, "Group Discussion", Icons.Default.Forum, "GTO", 20, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_GPE, "Group Planning Exercise", Icons.Default.Map, "GTO", 30, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_PGT, "Progressive Group Task", Icons.AutoMirrored.Filled.TrendingUp, "GTO", 45, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_GOR, "Group Obstacle Race", Icons.AutoMirrored.Filled.DirectionsRun, "GTO", 60, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_HGT, "Half Group Task", Icons.Default.People, "GTO", 25, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_LECTURETTE, "Lecturette", Icons.Default.Mic, "GTO", 3, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_IO, "Individual Obstacles", Icons.Default.Person, "GTO", 10, 10, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_CT, "Command Task", Icons.Default.MilitaryTech, "GTO", 15, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.GTO_FGT, "Final Group Task", Icons.AutoMirrored.Filled.DirectionsRun, "GTO", 30, 1, phase2Progress.gtoProgress.status, phase2Progress.gtoProgress.latestScore),
                    TestOverviewItem(TestType.IO, "Personal Interview", Icons.Default.RecordVoiceOver, "Interview", 45, 1, phase2Progress.interviewProgress.status, phase2Progress.interviewProgress.latestScore)
                )

                _uiState.value = StudentTestsUiState(
                    phase1Tests = phase1Tests,
                    phase2Tests = phase2Tests,
                    isLoading = false,
                    error = null
                )
            } catch (e: Exception) {
                logger.e(TAG, "Error loading student tests", e)
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load tests") }
            }
        }
    }
}

/**
 * UI State for Student Tests Screen
 */
data class StudentTestsUiState(
    val phase1Tests: List<TestOverviewItem> = emptyList(),
    val phase2Tests: List<TestOverviewItem> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

data class TestOverviewItem(
    val type: TestType,
    val name: String,
    val icon: ImageVector,
    val category: String,
    val durationMinutes: Int,
    val questionCount: Int,
    val status: TestStatus,
    val latestScore: Float?
)
