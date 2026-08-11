import { Routes } from '../generated/contracts';

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch payload -- the wire
 * shape of `feature_flags/config`. Mirrors KMP's `FeatureFlags` domain model
 * (`shared/.../domain/model/FeatureFlags.kt`) field-for-field.
 */
export interface FeatureFlags {
  minimumSupportedAppVersion: string;
  flags: Record<string, boolean>;
}

/**
 * Fail-open fallback: the version baked into this build at build time
 * (`contracts/routes.yaml`), used whenever the live Firestore doc is
 * unreachable or missing. Never blocks on its own.
 */
export const SAFE_DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  minimumSupportedAppVersion: Routes.MINIMUM_SUPPORTED_APP_VERSION,
  flags: {}
};

/**
 * Compares dotted major.minor.patch version strings (numeric per-segment
 * compare, not lexicographic). Missing or non-numeric segments are treated
 * as 0. Mirrors KMP's `isAppVersionBelowMinimum` exactly -- see that
 * function's doc comment for why malformed input can't throw here either.
 */
export function isAppVersionBelowMinimum(current: string, minimum: string): boolean {
  const currentParts = current.split('.').map((s) => parseInt(s, 10) || 0);
  const minParts = minimum.split('.').map((s) => parseInt(s, 10) || 0);
  const length = Math.max(currentParts.length, minParts.length);
  for (let i = 0; i < length; i++) {
    const c = currentParts[i] ?? 0;
    const m = minParts[i] ?? 0;
    if (c !== m) return c < m;
  }
  return false;
}
