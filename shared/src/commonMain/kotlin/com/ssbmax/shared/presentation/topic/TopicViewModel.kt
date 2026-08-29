package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.data.repository.ContentSource
import com.ssbmax.shared.data.repository.TopicContentData
import com.ssbmax.shared.domain.config.ContentFeatureFlags
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.StudyContentRepository
import com.ssbmax.shared.domain.repository.TestProgressRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of the Android `app/.../ui/topic/TopicViewModel.kt`. Manages
 * topic information, study materials, and tests for a specific SSB topic --
 * supports cloud (Firestore) content with automatic per-topic fallback to
 * local hardcoded content, same as the Android original.
 *
 * Deviations from the Android original, both following precedents already
 * established elsewhere in this phase:
 * - `SavedStateHandle`-injected `topicId` replaced with an explicit
 *   [loadTopic] call the screen makes in a `LaunchedEffect(topicId)`.
 * - `android.util.Log` calls replaced with [DomainLogger]; the Android
 *   original's verbose feature-flag debug logging block is kept (same
 *   log lines, just via the KMP-safe logger interface) since it's a real
 *   debugging aid for the cloud/local content-source decision, not noise.
 * - `com.ssbmax.core.data.repository.{TopicContentData,ContentSource}`
 *   (Android-only `core:data` module types) replaced with the KMP-native
 *   equivalents already defined in `com.ssbmax.shared.data.repository`
 *   (added during this migration's Phase 2 `GitLiveStudyContentRepository`
 *   work) -- same shapes, no behavior change.
 * - Real `androidx.lifecycle.ViewModel` + `viewModelScope` (Phase 1 of the
 *   KMP-convergence plan, see
 *   [com.ssbmax.shared.presentation.oir.OIRTestViewModel]'s doc comment for
 *   the precedent this mirrors).
 */
class TopicViewModel(
    private val testProgressRepository: TestProgressRepository,
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val studyContentRepository: StudyContentRepository,
    private val interviewRepository: InterviewRepository,
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(TopicUiState())
    val uiState: StateFlow<TopicUiState> = _uiState.asStateFlow()

    private var testType: String = "OIR"

    private companion object {
        const val TAG = "TopicViewModel"
    }

    fun loadTopic(topicId: String) {
        testType = topicId
        loadTopicContent()
        if (testType.equals("INTERVIEW", ignoreCase = true)) {
            loadInterviewHistory()
        }
    }

    private fun loadInterviewHistory() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingInterviewHistory = true) }

            try {
                val user = observeCurrentUser().first()
                val userId = user?.id ?: return@launch

                interviewRepository.getUserResults(userId)
                    .catch { e ->
                        logger.e(TAG, "Failed to load interview history", e)
                        _uiState.update { it.copy(isLoadingInterviewHistory = false) }
                    }
                    .collect { results ->
                        _uiState.update {
                            it.copy(
                                pastInterviewResults = results.sortedByDescending { r -> r.completedAt },
                                isLoadingInterviewHistory = false
                            )
                        }
                    }
            } catch (e: Exception) {
                logger.e(TAG, "Exception loading interview history", e)
                _uiState.update { it.copy(isLoadingInterviewHistory = false) }
            }
        }
    }

    private fun loadTopicContent() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                val currentUser = observeCurrentUser().first()
                val userId = currentUser?.id

                val useCloud = ContentFeatureFlags.isTopicCloudEnabled(testType)
                logger.d(TAG, "Feature flag check for $testType -- useCloudContent(master)=${ContentFeatureFlags.useCloudContent}, isTopicCloudEnabled=$useCloud")

                if (useCloud) {
                    loadFromCloud(userId)
                } else {
                    loadFromLocal(userId)
                }
            } catch (e: Exception) {
                logger.e(TAG, "Error loading topic content", e)
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load topic content") }
            }
        }
    }

    private suspend fun loadFromCloud(userId: String?) {
        try {
            studyContentRepository.getTopicContent(testType)
                .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = Result.success(null))
                .collect { result ->
                    result.onSuccess { data ->
                        if (data is TopicContentData) {
                            if (data.source == ContentSource.CLOUD) {
                                applyCloudContent(data, userId)
                            } else {
                                loadFromLocal(userId)
                            }
                        } else {
                            loadFromLocal(userId)
                        }
                    }.onFailure { error ->
                        logger.e(TAG, "Cloud loading failed", error)
                        if (ContentFeatureFlags.fallbackToLocalOnError) {
                            loadFromLocal(userId)
                        } else {
                            _uiState.update { it.copy(isLoading = false, error = "Failed to load content: ${error.message}") }
                        }
                    }
                }
        } catch (e: Exception) {
            logger.e(TAG, "Exception during cloud load", e)
            loadFromLocal(userId)
        }
    }

    private suspend fun applyCloudContent(data: TopicContentData, userId: String?) {
        val cloudMaterials = data.materials.map { cloudMaterial ->
            StudyMaterialItem(
                id = cloudMaterial.id,
                title = cloudMaterial.title,
                duration = cloudMaterial.readTime,
                isPremium = cloudMaterial.isPremium
            )
        }

        val materials = if (testType.uppercase() == "PIQ_FORM" || testType.uppercase() == "PIQ") {
            val localMaterials = TopicContentLoader.getTopicInfo(testType).studyMaterials
            val piqFormReference = localMaterials.firstOrNull { it.id == "piq_form_reference" }
            if (piqFormReference != null) listOf(piqFormReference) + cloudMaterials else cloudMaterials
        } else {
            cloudMaterials
        }

        val testProgress = loadTestProgress(userId)
        // D4 forbids parsing `data.introduction` (live Firestore markdown) into a DocumentModel
        // at runtime, so this fetches the D2 side document instead -- see the function's doc.
        val structuredIntroduction = structuredIntroductionFor(testType)

        _uiState.update {
            it.copy(
                testType = testType,
                topicTitle = data.title,
                introduction = data.introduction,
                introductionSections = structuredIntroduction,
                studyMaterials = materials,
                availableTests = getTestsForTopic(testType),
                testCompletionStatus = testProgress?.status,
                testLatestScore = testProgress?.latestScore,
                isLoading = false,
                error = null,
                contentSource = "Cloud (Firestore)"
            )
        }
    }

    private suspend fun loadFromLocal(userId: String?) {
        try {
            val topicInfo = TopicContentLoader.getTopicInfo(testType)
            val testProgress = loadTestProgress(userId)
            val structuredIntroduction = structuredIntroductionFor(testType)

            _uiState.update {
                it.copy(
                    testType = testType,
                    topicTitle = topicInfo.title,
                    introduction = topicInfo.introduction,
                    introductionSections = structuredIntroduction,
                    studyMaterials = topicInfo.studyMaterials,
                    availableTests = topicInfo.tests,
                    testCompletionStatus = testProgress?.status,
                    testLatestScore = testProgress?.latestScore,
                    isLoading = false,
                    error = null,
                    contentSource = "Local"
                )
            }
        } catch (e: Exception) {
            logger.e(TAG, "Failed to load local content", e)
            _uiState.update { it.copy(isLoading = false, error = "Failed to load local content: ${e.message}") }
        }
    }

    /**
     * Prefers the D2 side document `topic_sections/{testType}` (Phase 5, docs/plans/
     * write-the-phased-plan-wobbly-pancake.md) fetched via [studyContentRepository], falling
     * back to [TopicContentLoader.getStructuredIntroduction]'s generated offline copy of the
     * exact same source (never a network call). Returns null -- same as before Phase 5 -- only
     * when the topic isn't behind the [ContentFeatureFlags.isStructuredRenderingEnabled]
     * rollout flag, so [TopicUiState.introduction] keeps rendering as markdown text for
     * everything not yet flagged on. Shared by both [loadFromLocal] and [applyCloudContent] so
     * the same resolution order applies regardless of which tier the rest of the screen's
     * content came from.
     */
    private suspend fun structuredIntroductionFor(testType: String): com.ssbmax.shared.ui.content.blocks.DocumentModel? {
        if (!ContentFeatureFlags.isStructuredRenderingEnabled(testType)) return null
        val cloudSections = studyContentRepository.getTopicSections(testType).getOrNull()
        return cloudSections ?: TopicContentLoader.getStructuredIntroduction(testType)
    }

    private suspend fun loadTestProgress(userId: String?): TestProgress? {
        return if (userId != null) {
            try {
                when (testType) {
                    "OIR" -> testProgressRepository.getPhase1Progress(userId).first().oirProgress
                    "PPDT" -> testProgressRepository.getPhase1Progress(userId).first().ppdtProgress
                    else -> testProgressRepository.getPhase2Progress(userId).first().psychologyProgress
                }
            } catch (e: Exception) {
                logger.w(TAG, "Failed to load test progress: ${e.message}")
                null
            }
        } else {
            null
        }
    }

    private fun getTestsForTopic(testType: String): List<TestType> {
        return when (testType.uppercase()) {
            "OIR" -> listOf(TestType.OIR)
            "PPDT" -> listOf(TestType.PPDT)
            "PIQ", "PIQ_FORM" -> listOf(TestType.PIQ)
            "PSYCHOLOGY" -> listOf(TestType.TAT, TestType.WAT, TestType.SRT, TestType.SD)
            "GTO" -> listOf(
                TestType.GTO_GD, TestType.GTO_GPE, TestType.GTO_PGT, TestType.GTO_GOR,
                TestType.GTO_HGT, TestType.GTO_LECTURETTE, TestType.GTO_IO, TestType.GTO_CT
            )
            "INTERVIEW" -> listOf(TestType.IO)
            else -> emptyList()
        }
    }

    fun refresh() {
        loadTopicContent()
    }
}
