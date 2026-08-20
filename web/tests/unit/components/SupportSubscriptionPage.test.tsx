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

  it('renders the joined snapshot panels on a successful admin lookup, including a source marked unavailable', async () => {
    const snapshot = {
      userId: 'user-1',
      firestore: { tier: 'PREMIUM' },
      razorpay: { unavailable: true },
      revenueCat: { status: 'NONE' },
      alerts: []
    };
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue({ data: snapshot }) as any);

    render(<SupportSubscriptionPage />);
    submitLookup('user-1');

    await waitFor(() => expect(screen.getByTestId('support-snapshot')).toBeInTheDocument());
    expect(screen.queryByTestId('support-error')).not.toBeInTheDocument();
    expect(screen.getAllByText(strings.support.sourceUnavailable)).toHaveLength(1);
  });
});
