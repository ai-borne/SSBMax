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

  it('reads BASIC, PRO and PREMIUM tiers verbatim (case-insensitively)', async () => {
    // BASIC (added Phase 2) was previously dropped to FREE here -- a real regression fixed as
    // part of Phase 3, since this file's getTier is now also relied on for the anniversary reset.
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'basic' }) } as any);
    expect(await repository.getTier('user_1')).toBe('BASIC');

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

  describe('getStartDate (Phase 3)', () => {
    it('returns null when the tier document does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as any);
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns null when Firestore read throws (falls back to calendar-month reset)', async () => {
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns null when startDate is absent or zero, not a falsy-but-wrong value', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'FREE' }) } as any);
      expect(await repository.getStartDate('user_1')).toBeNull();

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PRO', startDate: 0 }) } as any);
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns the real startDate when present', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PRO', startDate: 1_700_000_000_000 }) } as any);
      expect(await repository.getStartDate('user_1')).toBe(1_700_000_000_000);
    });
  });
});
