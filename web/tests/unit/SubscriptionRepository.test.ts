import { describe, it, expect, vi } from 'vitest';
import { SubscriptionRepository, deriveEffectiveTier } from '../../src/repositories/SubscriptionRepository';
import { getDoc, DocumentSnapshot } from 'firebase/firestore';

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
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as unknown as DocumentSnapshot);
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('fails closed to FREE when Firestore read throws', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('fails closed to FREE on an unrecognized tier value rather than trusting it', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'GOLD' }) } as unknown as DocumentSnapshot);
    expect(await repository.getTier('user_1')).toBe('FREE');
  });

  it('reads BASIC, PRO and PREMIUM tiers verbatim (case-insensitively)', async () => {
    // BASIC (added Phase 2) was previously dropped to FREE here -- a real regression fixed as
    // part of Phase 3, since this file's getTier is now also relied on for the anniversary reset.
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'basic' }) } as unknown as DocumentSnapshot);
    expect(await repository.getTier('user_1')).toBe('BASIC');

    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'pro' }) } as unknown as DocumentSnapshot);
    expect(await repository.getTier('user_1')).toBe('PRO');

    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PREMIUM' }) } as unknown as DocumentSnapshot);
    expect(await repository.getTier('user_1')).toBe('PREMIUM');
  });

  it('returns zeroed usage when the monthly usage document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as unknown as DocumentSnapshot);
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
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as unknown as DocumentSnapshot);
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns null when Firestore read throws (falls back to calendar-month reset)', async () => {
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns null when startDate is absent or zero, not a falsy-but-wrong value', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'FREE' }) } as unknown as DocumentSnapshot);
      expect(await repository.getStartDate('user_1')).toBeNull();

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PRO', startDate: 0 }) } as unknown as DocumentSnapshot);
      expect(await repository.getStartDate('user_1')).toBeNull();
    });

    it('returns the real startDate when present', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'PRO', startDate: 1_700_000_000_000 }) } as unknown as DocumentSnapshot);
      expect(await repository.getStartDate('user_1')).toBe(1_700_000_000_000);
    });
  });

  /**
   * Phase 4 amendment (dual-purchase gate): neither `webhooks.js` (Razorpay/web) nor
   * `revenueCatWebhook.js` (RevenueCat/mobile) reconciles against what the other already wrote to
   * `data/subscription` -- last write wins. `getOwnership` is what `SubscriptionPage.tsx` reads to
   * block a second, separate web purchase while an active mobile subscription exists.
   */
  describe('getOwnership (Phase 4 amendment)', () => {
    it('returns null source/expiryDate and willRenew:true when the tier document does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as unknown as DocumentSnapshot);
      expect(await repository.getOwnership('user_1')).toEqual({ source: null, expiryDate: null, willRenew: true });
    });

    it('fails open (no restriction) when Firestore read throws -- unlike getTier/getStartDate', async () => {
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
      expect(await repository.getOwnership('user_1')).toEqual({ source: null, expiryDate: null, willRenew: true });
    });

    it('reads source and expiryDate verbatim when present', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PRO', source: 'REVENUECAT', expiryDate: 1_700_000_000_000 })
      } as unknown as DocumentSnapshot);
      expect(await repository.getOwnership('user_1')).toEqual({ source: 'REVENUECAT', expiryDate: 1_700_000_000_000, willRenew: true });
    });

    it('treats a non-string source or non-number expiryDate as absent, not a trusted value', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PRO', source: 123, expiryDate: 'not-a-number' })
      } as unknown as DocumentSnapshot);
      expect(await repository.getOwnership('user_1')).toEqual({ source: null, expiryDate: null, willRenew: true });
    });

    it('reads willRenew:false when a subscription.cancelled/paused webhook has fired (Phase B)', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: 1_700_000_000_000, willRenew: false })
      } as unknown as DocumentSnapshot);
      expect(await repository.getOwnership('user_1')).toEqual({ source: 'RAZORPAY', expiryDate: 1_700_000_000_000, willRenew: false });
    });
  });

  /**
   * Phase 0 (docs/plans dual-platform billing hardening): a missed/delayed webhook must not leave
   * a stale elevated tier readable forever -- getTier derives the effective tier from expiryDate
   * at read time instead of trusting the stored `tier` field as-is.
   */
  describe('getTier expiry derivation (Phase 0)', () => {
    it('reads FREE when expiryDate is in the past, regardless of stored tier', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PREMIUM', expiryDate: Date.now() - 1_000 })
      } as unknown as DocumentSnapshot);
      expect(await repository.getTier('user_1')).toBe('FREE');
    });

    it('reads the stored tier when expiryDate is in the future', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PREMIUM', expiryDate: Date.now() + 1_000_000 })
      } as unknown as DocumentSnapshot);
      expect(await repository.getTier('user_1')).toBe('PREMIUM');
    });

    it('reads the stored tier when expiryDate is absent (legacy/grandfathered doc)', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ tier: 'PREMIUM' })
      } as unknown as DocumentSnapshot);
      expect(await repository.getTier('user_1')).toBe('PREMIUM');
    });
  });

  describe('deriveEffectiveTier', () => {
    it('returns FREE when expiryDate is in the past', () => {
      expect(deriveEffectiveTier('PREMIUM', 999, 1_000)).toBe('FREE');
    });

    it('returns the stored tier when expiryDate is in the future', () => {
      expect(deriveEffectiveTier('PREMIUM', 1_001, 1_000)).toBe('PREMIUM');
    });

    it('returns the stored tier when expiryDate is null', () => {
      expect(deriveEffectiveTier('PREMIUM', null, 1_000)).toBe('PREMIUM');
    });
  });
});
