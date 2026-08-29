package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.ui.content.blocks.DocumentModel

/**
 * UI State for Topic Screen. Split out of [TopicViewModel] purely to keep both files under the
 * repo's 300-line Quality Limit -- no behavior change from having it inline.
 */
data class TopicUiState(
    val testType: String = "",
    val topicTitle: String = "",
    val introduction: String = "",
    /** Structured twin of [introduction] (Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md)
     * -- null unless [com.ssbmax.shared.domain.config.ContentFeatureFlags.isStructuredRenderingEnabled]
     * is on for this topic (only OIR today; every topic has a generated [DocumentModel] fallback
     * since Phase 5, but the rollout flag still gates them in one at a time). D4 forbids parsing
     * [introduction] into one at runtime -- see [TopicViewModel.structuredIntroductionFor]. */
    val introductionSections: DocumentModel? = null,
    val studyMaterials: List<StudyMaterialItem> = emptyList(),
    val availableTests: List<TestType> = emptyList(),
    val testCompletionStatus: TestStatus? = null,
    val testLatestScore: Float? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val contentSource: String = "Local",
    val pastInterviewResults: List<InterviewResult> = emptyList(),
    val isLoadingInterviewHistory: Boolean = false
) {
    fun hasPastInterviews(): Boolean = pastInterviewResults.isNotEmpty()
}

/**
 * Study material item for list display
 */
data class StudyMaterialItem(
    val id: String,
    val title: String,
    val duration: String,
    val isPremium: Boolean
)
