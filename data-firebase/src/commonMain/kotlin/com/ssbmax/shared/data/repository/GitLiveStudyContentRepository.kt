package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.config.ContentFeatureFlags
import com.ssbmax.shared.domain.model.CloudStudyMaterial
import com.ssbmax.shared.domain.model.TopicContent
import com.ssbmax.shared.domain.repository.StudyContentRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import dev.gitlive.firebase.storage.storage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * GitLive-backed port of StudyContentRepositoryImpl + FirestoreContentSource
 * (merged into one class since the Android split existed only to separate
 * Hilt-injected Firebase clients from the cloud/local-fallback policy --
 * Koin doesn't need that separation, and the KMP port has no local-content
 * layer to fall back to yet, see loadFromLocal below). Same cloud-first,
 * local-fallback-on-error strategy as the Android original; Firestore's
 * offline-persistence init (FirestoreContentSource's `init` block) was not
 * ported -- GitLive's Firestore wrapper doesn't expose the same
 * PersistentCacheSettings builder, and this slice's scope is the read path,
 * not cache-tuning parity (a real gap, named not silently dropped).
 */
class GitLiveStudyContentRepository : StudyContentRepository {

    private val topicsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.TOPIC_CONTENT)
    private val materialsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.STUDY_MATERIALS)
    private val versionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.CONTENT_VERSIONS)

    override fun getTopicContent(topicType: String): Flow<Result<TopicContentData>> = flow {
        val normalizedType = topicType.uppercase()

        if (!ContentFeatureFlags.isTopicCloudEnabled(topicType)) {
            emit(loadFromLocal())
            return@flow
        }

        val cloudResult = runCatching { loadFromCloud(normalizedType) }
            .getOrElse { Result.failure(it) }

        if (cloudResult.isSuccess) {
            emit(cloudResult)
        } else if (ContentFeatureFlags.fallbackToLocalOnError) {
            emit(loadFromLocal())
        } else {
            emit(cloudResult)
        }
    }

    override suspend fun getStudyMaterials(topicType: String): Result<List<CloudStudyMaterial>> {
        if (!ContentFeatureFlags.isTopicCloudEnabled(topicType)) {
            return Result.success(emptyList())
        }
        return fetchStudyMaterials(topicType)
    }

    override suspend fun getStudyMaterial(materialId: String): Result<CloudStudyMaterial> {
        return runCatching {
            val snapshot = materialsCollection
                .where { "id" equalTo materialId }
                .limit(1)
                .get()
            val doc = snapshot.documents.firstOrNull()
                ?: throw NoSuchElementException("Material not found: $materialId")
            doc.data(CloudStudyMaterialDto.serializer()).toDomain()
        }
    }

    override suspend fun refreshContent(topicType: String): Result<TopicContent> {
        return runCatching {
            val doc = topicsCollection.document(topicType).get()
            if (!doc.exists) {
                throw NoSuchElementException("Topic not found: $topicType")
            }
            doc.data(TopicContentDto.serializer()).toDomain()
        }
    }

    /**
     * Get download URL for a Cloud Storage file -- not part of
     * StudyContentRepository's interface (the Android original exposed it
     * only via FirestoreContentSource, never through StudyContentRepository
     * itself), kept as a standalone method for whichever future ViewModel
     * needs it, same visibility level as the Android FirestoreContentSource.
     */
    suspend fun getDownloadUrl(storagePath: String): Result<String> {
        return runCatching {
            Firebase.storage.reference.child(storagePath).getDownloadUrl()
        }
    }

    internal suspend fun getContentVersion(): Result<ContentVersionDto> {
        return runCatching {
            val doc = versionsCollection.document(SsbContracts.FirestorePaths.CONTENT_VERSIONS_GLOBAL_DOC_ID).get()
            if (!doc.exists) {
                ContentVersionDto()
            } else {
                doc.data(ContentVersionDto.serializer())
            }
        }
    }

    private suspend fun loadFromCloud(normalizedType: String): Result<TopicContentData> {
        val doc = topicsCollection.document(normalizedType).get()
        if (!doc.exists) {
            return Result.failure(NoSuchElementException("Topic not found: $normalizedType"))
        }
        val topic = doc.data(TopicContentDto.serializer()).toDomain()

        val materials = fetchStudyMaterials(normalizedType).getOrElse { return Result.failure(it) }

        return Result.success(
            TopicContentData(
                title = topic.title,
                introduction = topic.introduction,
                materials = materials,
                source = ContentSource.CLOUD
            )
        )
    }

    private suspend fun fetchStudyMaterials(topicType: String): Result<List<CloudStudyMaterial>> {
        return runCatching {
            materialsCollection
                .where { "topicType" equalTo topicType }
                .orderBy("displayOrder")
                .get()
                .documents
                .mapNotNull { doc -> runCatching { doc.data(CloudStudyMaterialDto.serializer()).toDomain() }.getOrNull() }
        }
    }

    /**
     * Returns an empty LOCAL-flagged placeholder, same as the Android
     * original -- the real fallback content lives in the app layer's
     * TopicContentLoader (Compose/ViewModel territory, out of this
     * repository's reach by design, per the Android doc comment this
     * preserves).
     */
    private fun loadFromLocal(): Result<TopicContentData> {
        return Result.success(
            TopicContentData(title = "", introduction = "", materials = emptyList(), source = ContentSource.LOCAL)
        )
    }

}
