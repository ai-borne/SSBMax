import { describe, it, expect, vi } from 'vitest';
import { FeatureFlagRepository } from '../../src/repositories/FeatureFlagRepository';
import { getDoc, DocumentSnapshot } from 'firebase/firestore';
import { SAFE_DEFAULT_FEATURE_FLAGS } from '../../src/types/featureFlags';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

describe('FeatureFlagRepository', () => {
  it('falls back to SAFE_DEFAULT_FEATURE_FLAGS when the doc does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => null } as unknown as DocumentSnapshot);

    const flags = await new FeatureFlagRepository().getFeatureFlags();

    expect(flags).toEqual(SAFE_DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to SAFE_DEFAULT_FEATURE_FLAGS when the read throws -- never rejects', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));

    const flags = await new FeatureFlagRepository().getFeatureFlags();

    expect(flags).toEqual(SAFE_DEFAULT_FEATURE_FLAGS);
  });

  it('maps a live doc to FeatureFlags', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ minimumSupportedAppVersion: '9.9.9', flags: { gtoOthers: true } })
    } as unknown as DocumentSnapshot);

    const flags = await new FeatureFlagRepository().getFeatureFlags();

    expect(flags).toEqual({ minimumSupportedAppVersion: '9.9.9', flags: { gtoOthers: true } });
  });

  it('caches the first successful read -- a second call does not re-fetch', async () => {
    vi.mocked(getDoc).mockClear();
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ minimumSupportedAppVersion: '2.0.0', flags: {} })
    } as unknown as DocumentSnapshot);

    const repository = new FeatureFlagRepository();
    await repository.getFeatureFlags();
    const second = await repository.getFeatureFlags();

    expect(second.minimumSupportedAppVersion).toBe('2.0.0');
    expect(getDoc).toHaveBeenCalledTimes(1);
  });
});
