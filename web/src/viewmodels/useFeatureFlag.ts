import { useEffect, useState } from 'react';
import { FeatureFlagRepository } from '../repositories/FeatureFlagRepository';

/**
 * Generic single-flag reader for `feature_flags/config.flags` (Phase 8 Cross-Platform SSOT
 * remote kill-switch doc), mirroring `useAppVersionGateViewModel`'s fetch-once-per-mount shape.
 * Fails closed to `false` -- an unreachable/missing flags doc must never turn on a not-yet-verified
 * code path (e.g. Phase B's `razorpay_subscriptions_checkout` cutover flag).
 */
export function useFeatureFlag(flagKey: string, repository: FeatureFlagRepository = new FeatureFlagRepository()): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    repository.getFeatureFlags().then((flags) => {
      if (!isMounted) return;
      setEnabled(flags.flags[flagKey] === true);
    });
    return () => {
      isMounted = false;
    };
  }, [flagKey, repository]);

  return enabled;
}
