import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import { FeatureFlags, SAFE_DEFAULT_FEATURE_FLAGS } from '../types/featureFlags';
import { IFeatureFlagRepository } from './interfaces/IFeatureFlagRepository';

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch. Reads
 * `feature_flags/config` once per page load and holds the last successful
 * read in memory -- the "cached" half of "cached with a safe default" -- so
 * every subsequent call in the same session is a cache hit, not a re-fetch.
 * Mirrors KMP's `GitLiveFeatureFlagRepository` (`data-firebase/.../data/repository/`).
 */
export class FeatureFlagRepository implements IFeatureFlagRepository {
  private cached: FeatureFlags | null = null;

  async getFeatureFlags(): Promise<FeatureFlags> {
    if (this.cached) return this.cached;

    try {
      const snapshot = await getDoc(
        doc(db, FirestorePaths.FEATURE_FLAGS, FirestorePaths.FEATURE_FLAGS_CONFIG_DOC_ID)
      );
      if (!snapshot.exists()) {
        return SAFE_DEFAULT_FEATURE_FLAGS;
      }
      const data = snapshot.data();
      const flags: FeatureFlags = {
        minimumSupportedAppVersion:
          typeof data.minimumSupportedAppVersion === 'string'
            ? data.minimumSupportedAppVersion
            : SAFE_DEFAULT_FEATURE_FLAGS.minimumSupportedAppVersion,
        flags: typeof data.flags === 'object' && data.flags !== null ? data.flags : {}
      };
      this.cached = flags;
      return flags;
    } catch (error) {
      console.warn('Failed to fetch feature flags from Firestore, using safe default', error);
      return SAFE_DEFAULT_FEATURE_FLAGS;
    }
  }
}
