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
     * -- null only when both the network fetch and the generated [DocumentModel] offline fallback
     * come back empty (the per-topic rollout flag that used to gate this was removed in the
     * Phase 8 sweep, once all 9 topics had a generated fallback). D4 forbids parsing
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
    val isLoadingInterviewHistory: Boolean = false,
    val readSectionIds: Set<String> = emptySet()
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
