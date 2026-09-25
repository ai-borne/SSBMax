import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getDoc, type DocumentSnapshot } from 'firebase/firestore';
import { SubscriptionPage } from '../../../src/components/subscription/SubscriptionPage';
import { strings } from '../../../src/constants/strings';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined })
}));

vi.mock('../../../src/config/firebase', () => ({
  db: {}
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as unknown as DocumentSnapshot);
});

/**
 * Store-only billing (Razorpay retired 2026-09-25): purchases and cancellation happen in the App
 * Store / Google Play, RevenueCat writes the entitlement, and this page only reads it.
 */
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

  it('always tells the user subscriptions are managed in the app store', () => {
    render(<SubscriptionPage />);

    expect(screen.getByTestId('manage-in-store-notice')).toHaveTextContent(strings.subscription.manageInStore);
  });

  it('has no web checkout: paid tier cards show an "in the app" label, not an upgrade button', () => {
    render(<SubscriptionPage />);

    for (const tier of ['basic', 'pro', 'premium']) {
      expect(screen.queryByTestId(`upgrade-${tier}-button`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`${tier}-tier-card`)).toHaveTextContent(strings.subscription.availableInApp);
    }
  });

  it('never offers a web cancel action, even for a legacy RAZORPAY-sourced doc', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, willRenew: true })
    } as unknown as DocumentSnapshot);

    render(<SubscriptionPage userId="user_1" isPaidMember={true} />);

    await waitFor(() => expect(screen.getByTestId('subscription-renewal-status')).toBeInTheDocument());
    expect(screen.queryByTestId('cancel-subscription-link')).not.toBeInTheDocument();
  });

  /** The real Firestore-backed tier comes from the `isPaidMember` prop, so a hard reload of a paid user is correct. */
  it('shows Membership Active on first render when isPaidMember prop is true', () => {
    render(<SubscriptionPage isPaidMember={true} />);

    expect(screen.getByTestId('subscription-success-banner')).toBeInTheDocument();
  });

  it('does not show Membership Active when isPaidMember prop is false', () => {
    render(<SubscriptionPage isPaidMember={false} />);

    expect(screen.queryByTestId('subscription-success-banner')).not.toBeInTheDocument();
  });

  it('shows the renewal status read from the entitlement doc', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ tier: 'PRO', source: 'REVENUECAT', expiryDate: Date.now() + 100000, willRenew: true })
    } as unknown as DocumentSnapshot);

    render(<SubscriptionPage userId="user_1" isPaidMember={true} />);

    await waitFor(() => expect(screen.getByTestId('subscription-renewal-status')).toBeInTheDocument());
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
