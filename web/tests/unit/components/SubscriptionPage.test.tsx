import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionPage } from '../../../src/components/subscription/SubscriptionPage';
import { strings } from '../../../src/constants/strings';

// Mock Razorpay SDK on window
beforeEach(() => {
  vi.restoreAllMocks();
  (window as any).Razorpay = vi.fn().mockImplementation(() => ({
    open: vi.fn()
  }));
});

describe('SubscriptionPage Component', () => {
  it('renders subscription page title, pricing plans, and feature lists', () => {
    render(<SubscriptionPage />);

    expect(screen.getByTestId('subscription-page')).toBeInTheDocument();
    expect(screen.getAllByText(strings.subscription.title).length).toBeGreaterThan(0);
    expect(screen.getByText(strings.subscription.freePlanTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.proPlanTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.freePlanPrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.proPlanPrice)).toBeInTheDocument();
  });

  it('triggers upgrade order flow on upgrade button click', async () => {
    const mockCreateOrder = vi.fn().mockResolvedValue({
      orderId: 'order_test_123',
      amount: 49900,
      currency: 'INR',
      keyId: 'rzp_test_key'
    });

    render(<SubscriptionPage createOrderFn={mockCreateOrder} />);

    const upgradeBtn = screen.getByTestId('upgrade-pro-button');
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith('pro_monthly');
    });
  });

  it('displays error banner if order creation fails', async () => {
    const mockCreateOrder = vi.fn().mockRejectedValue(new Error('Order creation error'));

    render(<SubscriptionPage createOrderFn={mockCreateOrder} />);

    const upgradeBtn = screen.getByTestId('upgrade-pro-button');
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('subscription-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Order creation error')).toBeInTheDocument();
    });
  });
});
