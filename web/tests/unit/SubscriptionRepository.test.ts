import { describe, it, expect, vi } from 'vitest';
import { SubscriptionRepository } from '../../src/repositories/SubscriptionRepository';
import { getDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

/**
 * Mirrors the KMP fail-safe: an unknown/missing/malformed tier document must fail closed to
 * FREE, never to an elevated tier — a Firestore outage or a doc that hasn't been created yet
 * must never grant access it shouldn't (docs/plans/CrossPlatform_SSOT Phase 4 TDD requirement
 * "an unknown/missing tier document fails closed to FREE").
 */
describe('SubscriptionRepository', () => {
  const repository = new SubscriptionRepository();

  it('fails closed to FREE when the tier document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as any);
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('fails closed to FREE when Firestore read throws', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('fails closed to FREE on an unrecognized tier value rather than trusting it', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'GOLD' }) } as any);
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('reads PRO and PREMIUM tiers verbatim (case-insensitively)', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'pro' }) } as any);
    expect(await repository.getTier('user_1')).toBe('PRO');

    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PREMIUM' }) } as any);
    expect(await repository.getTier('user_1')).toBe('PREMIUM');
  });

  it('returns zeroed usage when the monthly usage document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as any);
    const usage = await repository.getMonthlyUsage('user_1', '2026-08');
    expect(usage.oirTestsUsed).toBe(0);
    expect(usage.interviewTestsUsed).toBe(0);
  });

  it('returns zeroed usage when Firestore read throws (fails closed like getTier, not to a stale cached count)', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    const usage = await repository.getMonthlyUsage('user_1', '2026-08');
    expect(usage.oirTestsUsed).toBe(0);
  });
});
