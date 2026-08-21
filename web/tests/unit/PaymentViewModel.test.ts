import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaymentViewModel, waitForTierUpgrade } from '../../src/viewmodels/PaymentViewModel';
import { RazorpayService } from '../../src/services/RazorpayService';

// Mock RazorpayService
vi.mock('../../src/services/RazorpayService', () => {
  return {
    RazorpayService: vi.fn().mockImplementation(() => ({
      openCheckout: vi.fn().mockImplementation((options) => {
        // Simulate immediate success callback in tests unless test specifies otherwise
        options.onSuccess('pay_test_123', options.orderId, 'sig_test_123');
      })
    }))
  };
});

describe('usePaymentViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default idle state', () => {
    const { result } = renderHook(() => usePaymentViewModel());
    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isPaidMember).toBe(false);
  });

  it('should transition through payment flow successfully with mock order creator', async () => {
    const mockOrderCreator = vi.fn().mockResolvedValue({
      orderId: 'order_123',
      amount: 49900,
      currency: 'INR',
      keyId: 'rzp_test_key'
    });

    const { result } = renderHook(() => usePaymentViewModel(mockOrderCreator));

    await act(async () => {
      await result.current.initiatePayment('pro_monthly', 'test@example.com', 'Test User');
    });

    expect(mockOrderCreator).toHaveBeenCalledWith('pro_monthly');
    expect(result.current.status).toBe('success');
    expect(result.current.isPaidMember).toBe(true);
    expect(result.current.paymentId).toBe('pay_test_123');
  });

  it('should handle order creation failure gracefully', async () => {
    const mockOrderCreator = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => usePaymentViewModel(mockOrderCreator));

    await act(async () => {
      await result.current.initiatePayment('pro_monthly');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Network error');
    expect(result.current.isPaidMember).toBe(false);
  });

  it('should handle checkout failure callback', async () => {
    vi.mocked(RazorpayService).mockImplementationOnce(() => ({
      openCheckout: vi.fn().mockImplementation((options) => {
        options.onFailure({ description: 'User cancelled payment' });
      })
    }) as any);

    const { result } = renderHook(() => usePaymentViewModel());

    await act(async () => {
      await result.current.initiatePayment('pro_monthly');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('User cancelled payment');
    expect(result.current.isPaidMember).toBe(false);
  });

  it('should reset status on call to resetStatus', async () => {
    const { result } = renderHook(() => usePaymentViewModel());

    act(() => {
      result.current.setIsPaidMember(true);
    });
    expect(result.current.isPaidMember).toBe(true);

    act(() => {
      result.current.resetStatus();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });

  /**
   * L5 (Payment Ecosystem Hardening plan, Phase 12): before this fix, checkout success reported
   * `status: 'success', isPaidMember: true` the instant Razorpay's client-side modal closed --
   * before `handleRazorpayWebhook` had ever run server-side. When `verifyTierFn` is wired, success
   * must wait for the tier to actually confirm the grant.
   */
  describe('with verifyTierFn wired (L5)', () => {
    it('polls verifyTierFn and only reports success once the tier is no longer FREE', async () => {
      const verifyTierFn = vi
        .fn()
        .mockResolvedValueOnce('FREE')
        .mockResolvedValueOnce('FREE')
        .mockResolvedValueOnce('PRO');

      const { result } = renderHook(() =>
        usePaymentViewModel(undefined, undefined, false, verifyTierFn, { maxAttempts: 6, delayMs: 0 })
      );

      // The mocked Razorpay SDK invokes `onSuccess` fire-and-forget (matching real SDK behavior --
      // the modal's callback isn't tied to `openCheckout`'s own returned promise), so `initiatePayment`
      // resolving does not imply the async onSuccess/polling chain has finished -- wait for it.
      act(() => {
        result.current.initiatePayment('pro_monthly');
      });

      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(verifyTierFn).toHaveBeenCalledTimes(3);
      expect(result.current.isPaidMember).toBe(true);
    });

    it('gives up after the max poll attempts and still resolves, isPaidMember false, if the webhook never lands', async () => {
      const verifyTierFn = vi.fn().mockResolvedValue('FREE');

      const { result } = renderHook(() =>
        usePaymentViewModel(undefined, undefined, false, verifyTierFn, { maxAttempts: 3, delayMs: 0 })
      );

      act(() => {
        result.current.initiatePayment('pro_monthly');
      });

      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(result.current.isPaidMember).toBe(false);
    });
  });
});

describe('waitForTierUpgrade', () => {
  it('returns immediately once verifyTierFn reports a non-FREE tier', async () => {
    const verifyTierFn = vi.fn().mockResolvedValue('PREMIUM');

    const tier = await waitForTierUpgrade(verifyTierFn, { delayMs: 0 });

    expect(tier).toBe('PREMIUM');
    expect(verifyTierFn).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts, then gives up and returns FREE', async () => {
    const verifyTierFn = vi.fn().mockResolvedValue('FREE');

    const tier = await waitForTierUpgrade(verifyTierFn, { maxAttempts: 3, delayMs: 0 });

    expect(tier).toBe('FREE');
    expect(verifyTierFn).toHaveBeenCalledTimes(3);
  });

  it('does not sleep after the final attempt (no wasted delay once giving up)', async () => {
    const verifyTierFn = vi.fn().mockResolvedValue('FREE');
    const start = Date.now();

    await waitForTierUpgrade(verifyTierFn, { maxAttempts: 2, delayMs: 50 });

    // One real delay between attempt 1 and 2, none after attempt 2 -- comfortably under 2x one delay.
    expect(Date.now() - start).toBeLessThan(90);
  });
});
