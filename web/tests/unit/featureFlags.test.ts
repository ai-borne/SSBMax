import { describe, it, expect } from 'vitest';
import { isAppVersionBelowMinimum, SAFE_DEFAULT_FEATURE_FLAGS } from '../../src/types/featureFlags';
import { Routes } from '../../src/generated/contracts';

/**
 * `isAppVersionBelowMinimum` is Phase 8's actual gate decision (mirrors
 * KMP's `FeatureFlagsTest.kt`) -- pinned directly since every other moving
 * part (repository, hook, screen) exists only to feed it two strings.
 */
describe('isAppVersionBelowMinimum', () => {
  it('treats equal versions as not below minimum', () => {
    expect(isAppVersionBelowMinimum('1.2.3', '1.2.3')).toBe(false);
  });

  it('treats a higher current version as not below minimum', () => {
    expect(isAppVersionBelowMinimum('2.0.0', '1.9.9')).toBe(false);
  });

  it('treats a lower current version as below minimum', () => {
    expect(isAppVersionBelowMinimum('1.0.0', '1.0.1')).toBe(true);
  });

  it('compares numerically, not lexicographically', () => {
    // Lexicographic compare would say "9" > "10" -- a real regression class for version strings.
    expect(isAppVersionBelowMinimum('1.9.0', '1.10.0')).toBe(true);
  });

  it('pads a shorter version string with zero segments', () => {
    expect(isAppVersionBelowMinimum('1.2', '1.2.0')).toBe(false);
    expect(isAppVersionBelowMinimum('1.2', '1.2.1')).toBe(true);
  });

  it('treats a malformed segment as zero instead of throwing', () => {
    expect(isAppVersionBelowMinimum('1.x.0', '1.0.0')).toBe(false);
  });
});

describe('SAFE_DEFAULT_FEATURE_FLAGS', () => {
  it('carries the compiled-in contract minimum and no flags', () => {
    expect(SAFE_DEFAULT_FEATURE_FLAGS.minimumSupportedAppVersion).toBe(Routes.MINIMUM_SUPPORTED_APP_VERSION);
    expect(SAFE_DEFAULT_FEATURE_FLAGS.flags).toEqual({});
  });
});
