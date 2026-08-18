import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../../src/services/PaymentService';
import { httpsCallable } from 'firebase/functions';

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
    vi.mocked(httpsCallable).mockReturnValue(callable as any);

    const service = new PaymentService();
    const result = await service.createOrder('pro_monthly');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createRazorpayOrder');
    expect(callable).toHaveBeenCalledWith({ planId: 'pro_monthly' });
    expect(result).toEqual({ success: true, orderId: 'order_1', amount: 49900, currency: 'INR', keyId: 'rzp_test_key' });
  });
});
