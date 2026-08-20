package com.ssbmax.shared.domain.model

/**
 * Topic content stored in Firestore
 * Collection: topic_content
 * Document ID: topic_type (e.g., "OIR", "PPDT")
 * 
 * Example Firestore structure:
 * /topic_content/OIR
 *   - id: "OIR"
 *   - topicType: "OIR"
 *   - title: "Officer Intelligence Rating"
 *   - introduction: "The OIR test evaluates..." (markdown)
 *   - version: 1
 *   - lastUpdated: 1234567890
 */
data class TopicContent(
    val id: String = "",
    val topicType: String = "",
    val title: String = "",
    val introduction: String = "", // Markdown text
    val version: Int = 1,
    val lastUpdated: Long = 0L,
    val isPremium: Boolean = false,
    val estimatedReadTime: Int = 5 // minutes
)

/**
 * Study material metadata in Firestore
 * Collection: study_materials
 * Document ID: auto-generated
 * 
 * Query pattern:
 * ```
 * firestore.collection(SsbContracts.FirestorePaths.STUDY_MATERIALS)
 *   .whereEqualTo("topicType", "OIR")
 *   .orderBy("displayOrder")
 * ```
 * 
 * This fetches ONLY OIR materials (not all 50+ materials)
 */
data class CloudStudyMaterial(
    val id: String = "",
    val topicType: String = "", // For querying by topic (indexed)
    val title: String = "",
    val category: String = "",
    val contentMarkdown: String = "", // Full text content
    val author: String = "",
    val readTime: String = "",
    val tags: List<String> = emptyList(),
    val isPremium: Boolean = false,
    val displayOrder: Int = 0, // For sorting (indexed)
    val relatedMaterials: List<String> = emptyList(),
    val attachments: List<CloudAttachment> = emptyList(), // Images, PDFs
    val version: Int = 1,
    val lastUpdated: Long = 0L
)

/**
 * Reference to Cloud Storage asset
 * Stored as nested object within CloudStudyMaterial
 * 
 * Example:
 * ```
 * attachments: [
 *   {
 *     id: "img1",
 *     type: "IMAGE",
 *     storagePath: "study_materials/oir/diagram1.jpg",
 *     fileName: "OIR Test Pattern Diagram",
 *     sizeBytes: 245760
 *   }
 * ]
 * ```
 */
data class CloudAttachment(
    val id: String = "",
    val type: AttachmentType = AttachmentType.IMAGE,
    val storagePath: String = "", // e.g., "study_materials/oir/image1.jpg"
    val fileName: String = "",
    val sizeBytes: Long = 0L,
    val downloadUrl: String? = null // Generated on-demand, not stored
)

/**
 * Content version tracking
 * Collection: content_versions
 * Document ID: "global"
 * 
 * Used for cache invalidation:
 * - Check remote version once per session
 * - If remote > local, clear cache and fetch new content
 */
data class ContentVersion(
    val topicsVersion: Int = 1,
    val materialsVersion: Int = 1,
    val lastUpdated: Long = 0L
)

// AttachmentType enum is defined in StudyMaterial.kt - using that one to avoid duplication
