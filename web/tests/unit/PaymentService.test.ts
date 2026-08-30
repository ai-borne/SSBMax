import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../../src/services/PaymentService';
import { httpsCallable, HttpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * Phase 4 amendment: `SubscriptionPage.tsx` (the real Razorpay purchase trigger) was mounted
 * nowhere in the app, so `createRazorpayOrder` (`functions/src/payments.js`) was never actually
 * called from web despite being fully implemented server-side. This pins the one thin wrapper
 * that closes that gap -- mirrors `SubmissionService.test.ts`'s pattern.
 */
describe('PaymentService', () => {
  it('createOrder calls the createRazorpayOrder callable with the given planId', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: { success: true, orderId: 'order_1', amount: 49900, currency: 'INR', keyId: 'rzp_test_key' }
    });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    const service = new PaymentService();
    const result = await service.createOrder('pro_monthly');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createRazorpayOrder');
    expect(callable).toHaveBeenCalledWith({ planId: 'pro_monthly' });
    expect(result).toEqual({ success: true, orderId: 'order_1', amount: 49900, currency: 'INR', keyId: 'rzp_test_key' });
  });

  /**
   * Phase 5 (H5a, Payment Ecosystem Hardening plan): `cancelSubscription` invokes the right
   * callable name with no payload -- the callable always targets the caller's own subscription
   * doc server-side (`context.auth.uid`), so there is nothing for the client to send.
   */
  it('cancelSubscription calls the cancelRazorpaySubscription callable with no payload', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: { success: true, subscriptionId: 'sub_abc123' }
    });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    const service = new PaymentService();
    const result = await service.cancelSubscription();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'cancelRazorpaySubscription');
    expect(callable).toHaveBeenCalledWith();
    expect(result).toEqual({ success: true, subscriptionId: 'sub_abc123' });
  });
});
