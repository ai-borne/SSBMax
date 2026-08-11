import { FeatureFlags } from '../../types/featureFlags';

/**
 * Never rejects -- a read failure resolves to `SAFE_DEFAULT_FEATURE_FLAGS`
 * rather than throwing, so a Firestore outage can't itself become the outage
 * this repository exists to let us recover from. See
 * `shared/.../domain/repository/FeatureFlagRepository.kt` for the KMP twin.
 */
export interface IFeatureFlagRepository {
  getFeatureFlags(): Promise<FeatureFlags>;
}
