import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentViewModel } from '../../src/viewmodels/PaymentViewModel';
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
});
