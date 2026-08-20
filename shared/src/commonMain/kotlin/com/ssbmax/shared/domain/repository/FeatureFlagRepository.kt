package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.FeatureFlags

/**
 * Phase 8 remote kill-switch source. Unlike other repositories in this
 * module, this one never surfaces failure to its caller -- a broken or
 * unreachable read must fail open to [FeatureFlags.SAFE_DEFAULT], not fail
 * the caller, or a Firestore outage would itself become the outage the
 * kill-switch exists to recover from.
 */
interface FeatureFlagRepository {
    suspend fun getFeatureFlags(): FeatureFlags
}
