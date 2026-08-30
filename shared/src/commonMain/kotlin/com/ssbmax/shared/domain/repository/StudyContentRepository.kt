package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.CloudStudyMaterial
import com.ssbmax.shared.domain.model.TopicContent
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import kotlinx.coroutines.flow.Flow

/**
 * Repository interface for study content
 * Abstracts away whether content comes from Firestore or local storage
 */
interface StudyContentRepository {
    
    /**
     * Get topic content with automatic cloud/local selection
     * Returns Flow for reactive updates
     */
    fun getTopicContent(topicType: String): Flow<Result<Any>> // Any type since we need flexible return
    
    /**
     * Get study materials for a topic from Firestore
     */
    suspend fun getStudyMaterials(topicType: String): Result<List<CloudStudyMaterial>>
    
    /**
     * Get single study material by ID
     */
    suspend fun getStudyMaterial(materialId: String): Result<CloudStudyMaterial>
    
    /**
     * Force refresh content from server (bypasses cache)
     */
    suspend fun refreshContent(topicType: String): Result<TopicContent>

    /**
     * Structured [DocumentModel] for a topic's introduction, from the D2 side document
     * `topic_sections/{topicType}` (Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md).
     * Fetched only when a topic detail screen is actually opened -- never as part of the topic
     * list query (D2's payload argument). `null` on success means "no side document for this
     * topic yet" (not every topic is published), which callers must treat the same as a
     * failure: fall back to the markdown `introduction` field / the generated KMP fallback.
     */
    suspend fun getTopicSections(topicType: String): Result<DocumentModel?>

    /**
     * Structured [DocumentModel] for one study material's body, from the D2 side document
     * `study_material_sections/{materialId}`. Same null-means-not-published contract as
     * [getTopicSections].
     */
    suspend fun getStudyMaterialSections(materialId: String): Result<DocumentModel?>
}

