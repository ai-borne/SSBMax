package com.ssbmax.shared.presentation.submissions

import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.usecase.submission.GetUserSubmissionsUseCase
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Clock

/**
 * KMP port of the Android `app/.../ui/submissions/SubmissionsListViewModel.kt`.
 *
 * A real `androidx.lifecycle.ViewModel` using `viewModelScope`; the screen
 * uses `koinViewModel()`.
 *
 * Deviation from the Android original: `observeCurrentUser().first()` (an
 * injected [com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase])
 * is replaced with [AuthRepository.currentUser]`.value` directly -- matches
 * this phase's [com.ssbmax.shared.presentation.results.HistoricResultsViewModel]
 * precedent (same repository, same "who's logged in" question, one dependency
 * instead of two). `System.currentTimeMillis()` (JVM-only) in [SubmissionItem.timeAgo]
 * replaced with `kotlinx.datetime.Clock.System.now()`, same seam used
 * throughout this migration. Everything else (filter/refresh, index-error
 * fallback to empty list, `Map<String, Any>` submission parsing) is an
 * unchanged port.
 */
class SubmissionsListViewModel(
    private val getUserSubmissions: GetUserSubmissionsUseCase,
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(SubmissionsListUiState())
    val uiState: StateFlow<SubmissionsListUiState> = _uiState.asStateFlow()

    init {
        loadSubmissions()
    }

    fun loadSubmissions(filterType: TestType? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val currentUserId: String = authRepository.currentUser.value?.id ?: run {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Please login to view submissions"
                        )
                    }
                    return@launch
                }

                val result = if (filterType != null) {
                    getUserSubmissions.byTestType(currentUserId, filterType)
                } else {
                    getUserSubmissions(currentUserId)
                }

                result.onSuccess { submissionsData ->
                    val submissions = submissionsData.map { data ->
                        SubmissionItem(
                            id = data["id"] as? String ?: "",
                            testType = TestType.valueOf(data["testType"] as? String ?: "TAT"),
                            testId = data["testId"] as? String ?: "",
                            status = SubmissionStatus.valueOf(data["status"] as? String ?: "DRAFT"),
                            submittedAt = data["submittedAt"] as? Long ?: 0L,
                            score = (data["data"] as? Map<*, *>)?.let { submissionData ->
                                (submissionData["aiPreliminaryScore"] as? Map<*, *>)?.get("overallScore") as? Float
                            }
                        )
                    }.sortedByDescending { it.submittedAt }

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            submissions = submissions,
                            filteredType = filterType,
                            error = null
                        )
                    }
                }.onFailure { error ->
                    val isIndexError = error.message?.contains("index", ignoreCase = true) == true ||
                        error.message?.contains("FAILED_PRECONDITION", ignoreCase = true) == true

                    if (isIndexError) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                submissions = emptyList(),
                                filteredType = filterType,
                                error = null
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                error = "Failed to load submissions: ${error.message}"
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message
                    )
                }
            }
        }
    }

    fun filterByType(type: TestType?) {
        _uiState.update { it.copy(filteredType = type) }
        loadSubmissions(type)
    }

    fun filterByStatus(status: SubmissionStatus?) {
        val currentSubmissions = _uiState.value.submissions
        _uiState.update {
            it.copy(
                filteredStatus = status,
                submissions = if (status != null) {
                    currentSubmissions.filter { submission -> submission.status == status }
                } else {
                    currentSubmissions
                }
            )
        }
    }

    fun refresh() {
        loadSubmissions(_uiState.value.filteredType)
    }
}

/**
 * UI State for Submissions List
 */
data class SubmissionsListUiState(
    val isLoading: Boolean = true,
    val submissions: List<SubmissionItem> = emptyList(),
    val filteredType: TestType? = null,
    val filteredStatus: SubmissionStatus? = null,
    val error: String? = null
) {
    val groupedByStatus: Map<SubmissionStatus, List<SubmissionItem>>
        get() = submissions.groupBy { it.status }

    val pendingCount: Int
        get() = submissions.count { it.status == SubmissionStatus.SUBMITTED_PENDING_REVIEW }

    val gradedCount: Int
        get() = submissions.count { it.status == SubmissionStatus.GRADED }

    val underReviewCount: Int
        get() = submissions.count { it.status == SubmissionStatus.UNDER_REVIEW }
}

/**
 * Submission item for list display
 */
data class SubmissionItem(
    val id: String,
    val testType: TestType,
    val testId: String,
    val status: SubmissionStatus,
    val submittedAt: Long,
    val score: Float? = null
) {
    val timeAgo: String
        get() {
            val diff = Clock.System.now().toEpochMilliseconds() - submittedAt
            val hours = diff / (1000 * 60 * 60)
            val days = hours / 24

            return when {
                days > 30 -> "${days / 30}mo ago"
                days > 0 -> "${days}d ago"
                hours > 0 -> "${hours}h ago"
                else -> "Just now"
            }
        }

    val testName: String
        get() = when (testType) {
            TestType.TAT -> "TAT - Thematic Apperception Test"
            TestType.WAT -> "WAT - Word Association Test"
            TestType.SRT -> "SRT - Situation Reaction Test"
            TestType.PPDT -> "PPDT - Picture Perception Test"
            TestType.PIQ -> "PIQ - Personal Information Questionnaire"
            TestType.SD -> "SD - Self Description"
            TestType.OIR -> "OIR - Officers Intelligence Rating"
            TestType.GTO_GD -> "GTO - Group Discussion"
            TestType.GTO_GPE -> "GTO - Group Planning Exercise"
            TestType.GTO_PGT -> "GTO - Progressive Group Task"
            TestType.GTO_GOR -> "GTO - Group Obstacle Race"
            TestType.GTO_HGT -> "GTO - Half Group Task"
            TestType.GTO_LECTURETTE -> "GTO - Lecturette"
            TestType.GTO_IO -> "GTO - Individual Obstacles"
            TestType.GTO_CT -> "GTO - Command Task"
            TestType.GTO_FGT -> "GTO - Final Group Task"
            TestType.IO -> "IO - Interview Officer"
        }

    val statusColor: String
        get() = when (status) {
            SubmissionStatus.DRAFT -> "#9E9E9E"
            SubmissionStatus.SUBMITTED_PENDING_REVIEW -> "#FF9800"
            SubmissionStatus.UNDER_REVIEW -> "#2196F3"
            SubmissionStatus.GRADED -> "#4CAF50"
            SubmissionStatus.RETURNED_FOR_REVISION -> "#F44336"
        }
}
