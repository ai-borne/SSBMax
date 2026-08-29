package com.ssbmax.shared.presentation.study

import com.ssbmax.shared.domain.config.ContentFeatureFlags
import com.ssbmax.shared.domain.model.StudyProgress
import com.ssbmax.shared.domain.repository.StudyContentRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.study.GetStudyMaterialDetailUseCase
import com.ssbmax.shared.domain.usecase.study.GetStudyProgressUseCase
import com.ssbmax.shared.domain.usecase.study.SaveStudyProgressUseCase
import com.ssbmax.shared.domain.usecase.study.TrackStudySessionUseCase
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Clock

/**
 * KMP port of the Android `app/.../ui/study/StudyMaterialDetailViewModel.kt`.
 * Handles material content loading and progress tracking.
 *
 * Deviations from the Android original, both following precedents already
 * established elsewhere in this phase:
 * - `SavedStateHandle`-injected `materialId` replaced with an explicit
 *   [loadMaterial] call the screen makes in a `LaunchedEffect(materialId)`,
 *   same "screen owns the ID, ViewModel is Koin-injected with no params"
 *   pattern as [com.ssbmax.shared.presentation.submissions.SubmissionDetailViewModel].
 * - The Android original's `Context`-dependent
 *   `StudyMaterialContentProvider.loadHTMLFromAssets` (Android asset-manager
 *   API) replaced with [StudyMaterialContentProvider.loadPIQFormHtml]
 *   (Compose Multiplatform resource reading, KMP-safe on both platforms).
 * - `System.currentTimeMillis()` (JVM-only) replaced with
 *   `Clock.System.now().toEpochMilliseconds()`.
 * - Real `androidx.lifecycle.ViewModel` + `viewModelScope` (Phase 1 of the
 *   KMP-convergence plan, see
 *   [com.ssbmax.shared.presentation.oir.OIRTestViewModel]'s doc comment for
 *   the precedent this mirrors).
 *
 * **Real finding, deliberately NOT mechanically ported:** the Android
 * original's `close()` called [endStudySession] (fire-and-forget
 * `scope.launch` of [TrackStudySessionUseCase.endSession]) THEN cancelled its
 * own manual scope. Naively renaming that to `override fun onCleared()` would
 * make this *worse* than the original, not equivalent:
 * `androidx.lifecycle.ViewModel.clear()` cancels `viewModelScope`'s Job
 * *before* invoking `onCleared()`, so a `.launch{}` started from inside
 * `onCleared()` never runs its body at all (the child coroutine is created
 * against an already-cancelled parent) -- the end-of-session bookkeeping call
 * would silently never fire, on every single exit. Instead, [endStudySession]
 * stays public and is called explicitly by the screen's own
 * `DisposableEffect(Unit) { onDispose { ... } }`, which (per Navigation
 * Compose's own back-stack-entry lifecycle) always runs before the entry's
 * `ViewModelStore` is cleared -- so `viewModelScope` is still alive when it
 * fires, same as the Android original's best-effort semantics, without the
 * `onCleared`-ordering trap above.
 */
class StudyMaterialDetailViewModel(
    private val getStudyMaterialDetail: GetStudyMaterialDetailUseCase,
    private val saveStudyProgress: SaveStudyProgressUseCase,
    private val trackStudySession: TrackStudySessionUseCase,
    private val getStudyProgress: GetStudyProgressUseCase,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val studyContentRepository: StudyContentRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(StudyMaterialDetailUiState())
    val uiState: StateFlow<StudyMaterialDetailUiState> = _uiState.asStateFlow()

    private var materialId: String = ""

    fun loadMaterial(materialId: String) {
        this.materialId = materialId
        loadMaterialContent()
        startStudySession()
    }

    private fun loadMaterialContent() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                val cloudResult = getStudyMaterialDetail(materialId)

                val material = cloudResult.getOrNull()?.let { cloudMaterial ->
                    StudyMaterialContent(
                        id = cloudMaterial.id,
                        title = cloudMaterial.title,
                        category = cloudMaterial.category,
                        author = cloudMaterial.author.ifEmpty { "SSB Expert" },
                        publishedDate = "2025",
                        readTime = cloudMaterial.readTime.ifEmpty { "10 min read" },
                        content = cloudMaterial.contentMarkdown,
                        isPremium = cloudMaterial.isPremium,
                        tags = emptyList(),
                        relatedMaterials = emptyList(),
                        sections = structuredSectionsFor(cloudMaterial.topicType, materialId)
                    )
                } ?: run {
                    if (materialId == "piq_form_reference") {
                        StudyMaterialContent(
                            id = "piq_form_reference",
                            title = "SSB PIQ Form (Reference)",
                            category = "PIQ Form",
                            author = "SSB",
                            publishedDate = "2025",
                            readTime = "5 min read",
                            content = StudyMaterialContentProvider.loadPIQFormHtml(),
                            isPremium = false,
                            tags = listOf("PIQ", "Form", "Reference"),
                            relatedMaterials = emptyList()
                        )
                    } else {
                        _uiState.update {
                            it.copy(isLoading = false, error = "Content not available. Please check your internet connection.")
                        }
                        return@launch
                    }
                }

                val currentUser = observeCurrentUser().first()
                val existingProgress = currentUser?.let {
                    getStudyProgress(it.id, materialId).getOrNull()
                }

                _uiState.update {
                    it.copy(
                        material = material,
                        readingProgress = existingProgress?.progress ?: 0f,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = "Unable to load content. Please check your internet connection and try again.")
                }
            }
        }
    }

    /**
     * D2 side document `study_material_sections/{materialId}` (Phase 5, docs/plans/
     * write-the-phased-plan-wobbly-pancake.md), fetched only when a material's detail screen is
     * actually opened. Unlike [com.ssbmax.shared.presentation.topic.TopicViewModel]'s topic
     * intros, study-material bodies have no generated offline fallback (out of scope for this
     * plan -- see its "Out of scope" section) -- a missing/failed fetch here means null, which
     * [StudyMaterialContent.sections] callers must treat as "render [StudyMaterialContent.content]
     * as markdown instead," same as today. Gated by
     * [ContentFeatureFlags.isStructuredStudyMaterialRenderingEnabled], not
     * [ContentFeatureFlags.isStructuredRenderingEnabled] -- see that flag's doc comment for why
     * study-material bodies don't need the topic-intro offline-fallback gate.
     */
    private suspend fun structuredSectionsFor(topicType: String, materialId: String): DocumentModel? {
        if (!ContentFeatureFlags.isStructuredStudyMaterialRenderingEnabled(topicType)) return null
        return studyContentRepository.getStudyMaterialSections(materialId).getOrNull()
    }

    private fun startStudySession() {
        viewModelScope.launch {
            val currentUser = observeCurrentUser().first()
            if (currentUser != null) {
                val sessionResult = trackStudySession.startSession(currentUser.id, materialId)
                _uiState.update { it.copy(activeSessionId = sessionResult.getOrNull()?.id) }
            }
        }
    }

    fun updateProgress(progress: Float) {
        val coercedProgress = progress.coerceIn(0f, 100f)
        _uiState.update { it.copy(readingProgress = coercedProgress) }

        viewModelScope.launch {
            val currentUser = observeCurrentUser().first()
            if (currentUser != null) {
                val studyProgress = StudyProgress(
                    materialId = materialId,
                    userId = currentUser.id,
                    progress = coercedProgress,
                    lastReadAt = Clock.System.now().toEpochMilliseconds(),
                    timeSpent = 0L,
                    isCompleted = coercedProgress >= 100f
                )
                saveStudyProgress(studyProgress)
            }
        }
    }

    fun endStudySession() {
        viewModelScope.launch {
            _uiState.value.activeSessionId?.let { id ->
                val progressIncrement = _uiState.value.readingProgress
                trackStudySession.endSession(id, progressIncrement)
            }
        }
    }
}

/**
 * UI State for Study Material Detail Screen
 */
data class StudyMaterialDetailUiState(
    val material: StudyMaterialContent? = null,
    val readingProgress: Float = 0f,
    val isLoading: Boolean = false,
    val error: String? = null,
    val activeSessionId: String? = null
)

/**
 * Study material content model
 */
data class StudyMaterialContent(
    val id: String,
    val title: String,
    val category: String,
    val author: String,
    val publishedDate: String,
    val readTime: String,
    val content: String,
    val isPremium: Boolean,
    val tags: List<String>,
    val relatedMaterials: List<RelatedMaterial>,
    /** Structured twin of [content] (Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md)
     * -- null unless a `study_material_sections` side document exists and the topic is behind
     * [com.ssbmax.shared.domain.config.ContentFeatureFlags.isStructuredRenderingEnabled]; render
     * [content] as markdown when null, same as before this field existed. */
    val sections: DocumentModel? = null
)

/**
 * Related material item
 */
data class RelatedMaterial(
    val id: String,
    val title: String
)
