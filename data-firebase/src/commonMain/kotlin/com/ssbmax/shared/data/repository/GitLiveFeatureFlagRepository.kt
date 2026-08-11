package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.domain.repository.FeatureFlagRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore

/**
 * GitLive-Firebase-backed Phase 8 remote kill-switch. Reads
 * `feature_flags/config` once per process lifetime (this repository is a
 * Koin singleton) and holds the last successful read in memory as the
 * "cached" half of the plan's "cached with a safe default" requirement --
 * every subsequent call in the same launch is a cache hit, not a re-fetch.
 * A read failure never overwrites the cache and always falls back to
 * [FeatureFlags.SAFE_DEFAULT] rather than propagating -- see
 * [FeatureFlagRepository]'s doc comment for why.
 */
class GitLiveFeatureFlagRepository : FeatureFlagRepository {

    private var cached: FeatureFlags? = null

    override suspend fun getFeatureFlags(): FeatureFlags {
        cached?.let { return it }
        return try {
            val snapshot = Firebase.firestore
                .collection(SsbContracts.FirestorePaths.FEATURE_FLAGS)
                .document(SsbContracts.FirestorePaths.FEATURE_FLAGS_CONFIG_DOC_ID)
                .get()
            val flags = if (snapshot.exists) {
                snapshot.data(FeatureFlagsDto.serializer()).toDomain()
            } else {
                FeatureFlags.SAFE_DEFAULT
            }
            cached = flags
            flags
        } catch (e: Exception) {
            FeatureFlags.SAFE_DEFAULT
        }
    }
}
