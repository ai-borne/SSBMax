import { describe, it, expect, vi } from 'vitest';
import { SupportRepository } from '../../src/repositories/SupportRepository';
import { httpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * Phase 9 (Payment Ecosystem Hardening plan): pins the one thin wrapper around the admin-gated
 * `getSubscriptionSupportSnapshot` callable, mirroring `PaymentService.test.ts`'s pattern -- the
 * same class of gap that pattern was written to catch (a repository wired to the wrong callable
 * name, or dropping the payload) would otherwise only surface as a live "permission-denied" or
 * "not-found" in production.
 */
describe('SupportRepository', () => {
  it('getSubscriptionSupportSnapshot calls the getSubscriptionSupportSnapshot callable with the given userId', async () => {
    const snapshot = {
      userId: 'user-1',
      firestore: { tier: 'PREMIUM' },
      razorpay: null,
      revenueCat: { status: 'NONE' },
      alerts: []
    };
    const callable = vi.fn().mockResolvedValue({ data: snapshot });
    vi.mocked(httpsCallable).mockReturnValue(callable as any);

    const repository = new SupportRepository();
    const result = await repository.getSubscriptionSupportSnapshot('user-1');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getSubscriptionSupportSnapshot');
    expect(callable).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toEqual(snapshot);
  });
});
