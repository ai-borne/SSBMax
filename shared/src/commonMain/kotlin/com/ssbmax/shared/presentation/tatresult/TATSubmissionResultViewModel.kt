package com.ssbmax.shared.presentation.tatresult

import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.scoring.EntryType
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.validation.SSBRecommendationUIModel
import com.ssbmax.shared.domain.validation.ValidationIntegration
import com.ssbmax.shared.ui.components.result.UnifiedResultUiState
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of `app/.../ui/tests/tat/TATSubmissionResultViewModel.kt`.
 *
 * Unlike the Android original (which parses a raw Firestore `Map<String,
 * Any>` snapshot by hand -- `parseTATSubmission`/`parseOLQResult`, ~120 lines
 * of manual `as?` casts, plus a "prevent regression from COMPLETED+OLQ to
 * incomplete state" guard against conflicting snapshots), this port uses
 * [SubmissionRepository.observeTATSubmission]
 * / [SubmissionRepository.getTATResult], which already return typed
 * [TATSubmission]/[OLQAnalysisResult] domain models (the GitLive repository
 * impl does the Firestore decode internally -- see `GitLiveSubmissionRepository`,
 * Phase 2). This is the same simplification
 * [com.ssbmax.shared.presentation.ppdtresult.PPDTSubmissionResultViewModel]'s
 * doc comment documents for PPDT ("the GTO pattern"): observe in real time,
 * and once `analysisStatus == COMPLETED`, fetch the full result separately
 * and stop observing.
 *
 * `usesPartialAssessment` (`docs/architecture/TAT_Pipeline.md` §10a) is
 * preserved as a derived property on the UiState, exactly mirroring the
 * Android original's `TATSubmissionResultUiState.usesPartialAssessment` --
 * this is the one field genuinely specific to TAT among the OLQ-based test
 * types (PPDT/WAT/SRT/SDT don't batch multiple stories, so partial-assessment
 * degradation doesn't apply to them the same way).
 *
 * `CancellationException` contract preserved verbatim from PPDT's port: a
 * navigate-away cancels `viewModelScope`, which surfaces as `CancellationException`
 * inside `collect` -- must be re-thrown, not treated as a load failure.
 */
class TATSubmissionResultViewModel(
    private val submissionRepository: SubmissionRepository,
    private val logger: DomainLogger
) : ViewModel() {
    private val tag = "TATSubmissionResultViewModel"

    private val _uiState = MutableStateFlow(TATSubmissionResultUiState())
    val uiState: StateFlow<TATSubmissionResultUiState> = _uiState.asStateFlow()

    // Phase 3c (#16): the Android original hard-guarded against a later snapshot
    // regressing from COMPLETED back to an earlier status. This port's typed,
    // single-writer GitLive repository (see class doc comment above) shouldn't
    // be able to produce that sequence, so instead of re-porting the guard,
    // this flag turns the assumption into a monitored one -- if the warning
    // below never fires, the by-construction argument held.
    private var hasSeenCompleted = false

    fun loadSubmission(submissionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                submissionRepository.observeTATSubmission(submissionId).collect { submission ->
                    if (submission == null) {
                        _uiState.update { it.copy(isLoading = false, error = "Submission not found") }
                        return@collect
                    }
                    if (hasSeenCompleted && submission.analysisStatus != AnalysisStatus.COMPLETED) {
                        logger.w(tag, "Submission $submissionId regressed from COMPLETED to " +
                            "${submission.analysisStatus} after result was already loaded")
                    }
                    if (submission.analysisStatus == AnalysisStatus.COMPLETED) hasSeenCompleted = true
                    _uiState.update { it.copy(isLoading = false, submission = submission) }

                    if (submission.analysisStatus == AnalysisStatus.COMPLETED) {
                        loadResult(submissionId)
                        currentCoroutineContext().cancel() // terminal state -- stop observing Firestore
                    }
                }
            } catch (e: CancellationException) {
                throw e // CE is a control signal, not a fault
            } catch (e: Exception) {
                logger.e(tag, "Failed to load TAT submission result", e)
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load submission") }
            }
        }
    }

    /**
     * Loads OLQ result from `psych_results` after submission completion.
     * Submission metadata and the result document are written separately, so
     * retry briefly through Firestore's eventual-consistency window.
     */
    private suspend fun loadResult(submissionId: String) {
        repeat(30) { attempt ->
            try {
                val result = submissionRepository.getTATResult(submissionId)
                if (result.isSuccess && result.getOrNull() != null) {
                    val olqResult = result.getOrNull()!!
                    val ssbRecommendation = olqResult.olqScores.takeIf { it.isNotEmpty() }?.let { scores ->
                        val validationResult = ValidationIntegration.validateScores(
                            scores = scores,
                            entryType = EntryType.NDA
                        )
                        SSBRecommendationUIModel.fromValidationResult(validationResult, EntryType.NDA)
                    }
                    _uiState.update { currentState ->
                        currentState.submission?.let { submission ->
                            currentState.copy(
                                submission = submission.copy(olqResult = olqResult),
                                ssbRecommendation = ssbRecommendation
                            )
                        } ?: currentState
                    }
                    return
                }
                if (attempt < 29) delay(2_000)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (attempt == 29) logger.e(tag, "Failed to load TAT OLQ result", e)
                else delay(2_000)
            }
        }
        logger.w(tag, "TAT OLQ result was not available after 60 seconds: $submissionId")
    }
}

data class TATSubmissionResultUiState(
    override val isLoading: Boolean = true,
    val submission: TATSubmission? = null,
    override val ssbRecommendation: SSBRecommendationUIModel? = null,
    override val error: String? = null
) : UnifiedResultUiState {
    override val analysisStatus: AnalysisStatus
        get() = submission?.analysisStatus ?: AnalysisStatus.PENDING_ANALYSIS
    override val olqResult: OLQAnalysisResult?
        get() = submission?.olqResult
    val usesPartialAssessment: Boolean
        get() = submission?.olqResult?.usedPartialAssessment == true
}
