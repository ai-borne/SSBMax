package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.FeatureFlags
import kotlinx.serialization.Serializable

/**
 * Wire shape of `feature_flags/config` (Phase 8 remote kill-switch). Every
 * field has a default so a partially-written or legacy doc still decodes
 * instead of throwing -- the repository's own fail-open behaviour then
 * decides what to do with a read failure, this DTO just refuses to be the
 * cause of one.
 */
@Serializable
data class FeatureFlagsDto(
    val minimumSupportedAppVersion: String = SsbContracts.Routes.MINIMUM_SUPPORTED_APP_VERSION,
    val flags: Map<String, Boolean> = emptyMap()
) {
    fun toDomain(): FeatureFlags = FeatureFlags(
        minimumSupportedAppVersion = minimumSupportedAppVersion,
        flags = flags
    )
}
