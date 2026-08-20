import { useEffect, useState } from 'react';
import { FeatureFlagRepository } from '../repositories/FeatureFlagRepository';
import { isAppVersionBelowMinimum } from '../types/featureFlags';

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch gate. Fail-open by
 * construction: `updateRequired` starts `false` and only flips to `true`
 * once a fetched (or safe-default) `minimumSupportedAppVersion` is confirmed
 * to exceed this build's own `__APP_VERSION__` -- a slow or failed fetch
 * never blocks a real user. Mirrors KMP's `AppRootViewModel.updateRequired`.
 */
export function useAppVersionGateViewModel(
  repository: FeatureFlagRepository = new FeatureFlagRepository()
): boolean {
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    let isMounted = true;
    repository.getFeatureFlags().then((flags) => {
      if (!isMounted) return;
      setUpdateRequired(isAppVersionBelowMinimum(__APP_VERSION__, flags.minimumSupportedAppVersion));
    });
    return () => {
      isMounted = false;
    };
  }, [repository]);

  return updateRequired;
}
