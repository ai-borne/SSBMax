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

  /**
   * Phase E (dual-platform billing hardening plan): this page used to read `usePaymentViewModel`'s
   * own session-local `isPaidMember` (only ever true right after a checkout success in the same
   * session) instead of `App.tsx`'s real Firestore-backed tier -- so a hard reload of a genuinely
   * paid user showed the unpaid state until they purchased again in that session. The real value
   * must now come from the `isPaidMember` prop, regardless of `usePaymentViewModel`'s own state.
   */
  it('shows Membership Active and disables upgrade buttons on first render when isPaidMember prop is true', () => {
    render(<SubscriptionPage isPaidMember={true} />);

    expect(screen.getByTestId('subscription-success-banner')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-pro-button')).toBeDisabled();
  });

  it('does not show Membership Active when isPaidMember prop is false, even with no other state', () => {
    render(<SubscriptionPage isPaidMember={false} />);

    expect(screen.queryByTestId('subscription-success-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('upgrade-pro-button')).not.toBeDisabled();
  });

  /**
   * Phase 5 (H5a, Payment Ecosystem Hardening plan): the cancel action must only ever appear for
   * an active Razorpay-sourced subscription -- a RevenueCat-sourced one is cancelled via the
   * mobile app's store-managed flow (Phase 6), and offering it here would be a dead end.
   */
  it('shows the cancel action for an active Razorpay-sourced subscription with willRenew true', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: true })
    } as any);

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-subscription-link')).toBeInTheDocument();
    });
  });

  it('hides the cancel action for a RevenueCat-sourced (mobile) subscription', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'REVENUECAT', expiryDate: Date.now() + 100000, willRenew: true })
    } as any);

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('subscription-success-banner')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cancel-subscription-link')).not.toBeInTheDocument();
  });

  it('hides the cancel action once willRenew is already false (nothing left to cancel)', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: false })
    } as any);

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('subscription-success-banner')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cancel-subscription-link')).not.toBeInTheDocument();
  });

  it('cancel flow: click cancel -> confirm -> calls cancelSubscriptionFn and shows success', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: true })
    } as any);
    const mockCancel = vi.fn().mockResolvedValue({ success: true, subscriptionId: 'sub_1' });

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={mockCancel} />);

    await waitFor(() => expect(screen.getByTestId('cancel-subscription-link')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('cancel-subscription-link'));

    expect(screen.getByTestId('cancel-subscription-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-subscription-confirm-button'));

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('cancel-subscription-success')).toBeInTheDocument();
    });
  });

  it('cancel flow: "Keep My Subscription" dismisses the confirmation without calling cancelSubscriptionFn', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: true })
    } as any);
    const mockCancel = vi.fn();

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={mockCancel} />);

    await waitFor(() => expect(screen.getByTestId('cancel-subscription-link')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('cancel-subscription-link'));
    fireEvent.click(screen.getByTestId('cancel-subscription-keep-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('cancel-subscription-confirm')).not.toBeInTheDocument();
    });
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancel flow: shows an error state when cancelSubscriptionFn rejects', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: true })
    } as any);
    const mockCancel = vi.fn().mockRejectedValue(new Error('internal'));

    render(<SubscriptionPage userId="user_1" isPaidMember={true} cancelSubscriptionFn={mockCancel} />);

    await waitFor(() => expect(screen.getByTestId('cancel-subscription-link')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('cancel-subscription-link'));
    fireEvent.click(screen.getByTestId('cancel-subscription-confirm-button'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-subscription-error')).toBeInTheDocument();
    });
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
