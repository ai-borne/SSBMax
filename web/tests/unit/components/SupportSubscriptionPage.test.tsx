import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { httpsCallable } from 'firebase/functions';
import { SupportSubscriptionPage } from '../../../src/components/support/SupportSubscriptionPage';
import { strings } from '../../../src/constants/strings';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * Phase 9 (Payment Ecosystem Hardening plan). The permission-denied case is pinned specifically
 * because of a real bug caught during implementation: `firebase/functions`'s `FunctionsError` puts
 * the callable's error code on `.code` (`"functions/permission-denied"`), not inside `.message`
 * (which carries only the developer-supplied text, e.g. "Admin access required") -- an earlier
 * draft of this page string-matched `.message` for `'permission-denied'` and would have silently
 * never matched in production, always falling through to the generic error copy.
 */
describe('SupportSubscriptionPage', () => {
  function submitLookup(uid: string) {
    fireEvent.change(screen.getByTestId('support-userid-input'), { target: { value: uid } });
    fireEvent.click(screen.getByTestId('support-lookup-button'));
  }

  it('renders the admin-facing permission-denied copy when the callable rejects with functions/permission-denied', async () => {
    const error = Object.assign(new Error('Admin access required'), { code: 'functions/permission-denied' });
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('user-1');

    await waitFor(() => expect(screen.getByTestId('support-error')).toHaveTextContent(strings.support.permissionDenied));
  });

  it('renders the generic error copy for any other failure (e.g. internal)', async () => {
    const error = Object.assign(new Error('Unable to verify subscription'), { code: 'functions/internal' });
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('user-1');

    await waitFor(() => expect(screen.getByTestId('support-error')).toHaveTextContent(strings.support.genericError));
  });

  it('renders a distinct "no user found" message for functions/not-found (a typo\'d email or uid, not a server fault)', async () => {
    const error = Object.assign(new Error('No user found for that email'), { code: 'functions/not-found' });
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('nobody@example.com');

    await waitFor(() => expect(screen.getByTestId('support-error')).toHaveTextContent(strings.support.userNotFound));
  });

  it('renders the joined snapshot panels on a successful admin lookup, including a source marked unavailable', async () => {
    const snapshot = {
      userId: 'user-1',
      firestore: { tier: 'PREMIUM' },
      razorpay: { unavailable: true },
      revenueCat: { status: 'NONE' },
      alerts: { items: [], hasMore: false },
      conflict: null
    };
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue({ data: snapshot }) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('user-1');

    await waitFor(() => expect(screen.getByTestId('support-snapshot')).toBeInTheDocument());
    expect(screen.queryByTestId('support-error')).not.toBeInTheDocument();
    expect(screen.getAllByText(strings.support.sourceUnavailable)).toHaveLength(1);
  });

  /**
   * Live regression: the first real production lookup crashed the whole page (blank screen, no
   * error boundary) because `alerts` degraded to `{ unavailable: true }` (the ops_alerts composite
   * index wasn't deployed yet) and `SupportSnapshotPanels` unconditionally called `.map()` on it,
   * assuming it was always an array. Fixed to treat alerts as a fourth degradable source, same as
   * firestore/razorpay/revenueCat -- this pins that it renders instead of throwing.
   */
  it('renders the alerts panel as unavailable (not a crash) when alerts degrades to { unavailable: true }', async () => {
    const snapshot = {
      userId: 'user-1',
      firestore: { tier: 'FREE' },
      razorpay: null,
      revenueCat: { status: 'NONE' },
      alerts: { unavailable: true },
      conflict: null
    };
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue({ data: snapshot }) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('user-1');

    await waitFor(() => expect(screen.getByTestId('support-snapshot')).toBeInTheDocument());
    expect(screen.getByTestId('support-panel-alerts')).toHaveTextContent(strings.support.sourceUnavailable);
  });
});
