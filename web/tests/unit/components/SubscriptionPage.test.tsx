import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getDoc } from 'firebase/firestore';
import { SubscriptionPage } from '../../../src/components/subscription/SubscriptionPage';
import { strings } from '../../../src/constants/strings';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined })
}));

vi.mock('../../../src/config/firebase', () => ({
  db: {}
}));

// Mock Razorpay SDK on window
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as any);
  (window as any).Razorpay = vi.fn().mockImplementation(() => ({
    open: vi.fn()
  }));
});

describe('SubscriptionPage Component', () => {
  it('renders subscription page title and one card per tier (FREE/BASIC/PRO/PREMIUM)', () => {
    render(<SubscriptionPage />);

    expect(screen.getByTestId('subscription-page')).toBeInTheDocument();
    expect(screen.getAllByText(strings.subscription.title).length).toBeGreaterThan(0);
    expect(screen.getByTestId('free-tier-card')).toBeInTheDocument();
    expect(screen.getByTestId('basic-tier-card')).toBeInTheDocument();
    expect(screen.getByTestId('pro-tier-card')).toBeInTheDocument();
    expect(screen.getByTestId('premium-tier-card')).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonFreePrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonProPrice)).toBeInTheDocument();
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

  /**
   * Phase 4 amendment (dual-purchase gate): neither `webhooks.js` (Razorpay/web) nor
   * `revenueCatWebhook.js` (RevenueCat/mobile) reconciles against what the other already wrote to
   * `data/subscription` -- last write wins. A user with an active RevenueCat-sourced (mobile)
   * subscription must be blocked from starting a second, separate purchase here.
   */
  it('blocks purchase and shows a banner when the user has an active mobile (RevenueCat) subscription', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'REVENUECAT', expiryDate: null })
    } as any);
    const mockCreateOrder = vi.fn();

    render(<SubscriptionPage userId="user_1" createOrderFn={mockCreateOrder} />);

    await waitFor(() => {
      expect(screen.getByTestId('mobile-subscription-active-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('upgrade-pro-button')).toBeDisabled();

    fireEvent.click(screen.getByTestId('upgrade-pro-button'));
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('does not block purchase when there is no active mobile subscription', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as any);

    render(<SubscriptionPage userId="user_1" />);

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-subscription-active-banner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('upgrade-pro-button')).not.toBeDisabled();
  });

  it('applies Level 2 elevation styling to free-tier-card and pro-tier-card', () => {
    render(<SubscriptionPage />);

    const freeCard = screen.getByTestId('free-tier-card');
    expect(freeCard.className).toContain('dark:bg-slate-800/90');
    expect(freeCard.className).toContain('dark:border-slate-700/80');

    const proCard = screen.getByTestId('pro-tier-card');
    expect(proCard.className).toContain('dark:bg-slate-800/90');
  });
});
