import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportSnapshotPanels } from '../../../src/components/support/SupportSnapshotPanels';
import { strings } from '../../../src/constants/strings';
import type { SubscriptionSupportSnapshot } from '../../../src/repositories/SupportRepository';

/**
 * Phase 10 (Payment Ecosystem Hardening plan): the support snapshot panel renders data without
 * judging it before this phase, and a support agent trusting an unjudged panel is exactly how a
 * real ticket gets answered wrong. Each test pins one of the five gaps a real production lookup
 * (`mail.sunilpawar@gmail.com`) surfaced.
 */
const BASE_SNAPSHOT: SubscriptionSupportSnapshot = {
  userId: 'user-1',
  firestore: { tier: 'FREE', sourceKind: 'NONE' },
  razorpay: null,
  revenueCat: { status: 'NONE' },
  alerts: { items: [], hasMore: false },
  conflict: null
};

describe('SupportSnapshotPanels', () => {
  it('renders a distinct message for razorpay.dataIncomplete, not the generic "no Razorpay subscription" message (issue 1, the live case)', () => {
    render(
      <SupportSnapshotPanels
        snapshot={{
          ...BASE_SNAPSHOT,
          firestore: { tier: 'PRO', source: 'RAZORPAY', sourceKind: 'RAZORPAY_INCOMPLETE' },
          razorpay: { dataIncomplete: true, reason: 'missing-subscription-id' }
        }}
      />
    );

    expect(screen.getByTestId('support-razorpay-incomplete')).toHaveTextContent(strings.support.razorpayDataIncomplete);
    expect(screen.queryByText(strings.support.noRazorpaySubscription)).not.toBeInTheDocument();
  });

  it('renders the generic "no Razorpay subscription" message when razorpay is plain null (genuinely no purchase)', () => {
    render(<SupportSnapshotPanels snapshot={BASE_SNAPSHOT} />);

    expect(screen.getByText(strings.support.noRazorpaySubscription)).toBeInTheDocument();
    expect(screen.queryByTestId('support-razorpay-incomplete')).not.toBeInTheDocument();
  });

  it('renders a visible conflict banner when conflict.detected is true (issue 2)', () => {
    render(<SupportSnapshotPanels snapshot={{ ...BASE_SNAPSHOT, conflict: { detected: true } }} />);

    expect(screen.getByTestId('support-conflict-banner')).toHaveTextContent(strings.support.conflictDetected);
  });

  it('renders no conflict banner when conflict.detected is false or conflict is null', () => {
    const { rerender } = render(<SupportSnapshotPanels snapshot={{ ...BASE_SNAPSHOT, conflict: { detected: false } }} />);
    expect(screen.queryByTestId('support-conflict-banner')).not.toBeInTheDocument();

    rerender(<SupportSnapshotPanels snapshot={{ ...BASE_SNAPSHOT, conflict: null }} />);
    expect(screen.queryByTestId('support-conflict-banner')).not.toBeInTheDocument();
  });

  it('renders known timestamp fields (expiryDate, startDate, createdAt) formatted, not as raw epoch millis (issue 3)', () => {
    const expiry = 1787065806968;
    render(
      <SupportSnapshotPanels
        snapshot={{
          ...BASE_SNAPSHOT,
          firestore: { tier: 'PRO', sourceKind: 'RAZORPAY', expiryDate: expiry, startDate: expiry, createdAt: expiry }
        }}
      />
    );

    expect(screen.queryByText(String(expiry))).not.toBeInTheDocument();
    expect(screen.getAllByText(new Date(expiry).toLocaleString()).length).toBeGreaterThan(0);
  });

  it('renders a distinct label for firestore.sourceKind === LEGACY_OR_UNKNOWN instead of the generic key/value dump (issue 4)', () => {
    render(<SupportSnapshotPanels snapshot={{ ...BASE_SNAPSHOT, firestore: { tier: 'PRO', source: 'STRIPE', sourceKind: 'LEGACY_OR_UNKNOWN' } }} />);

    expect(screen.getByTestId('support-sourcekind-legacy')).toHaveTextContent(strings.support.legacyOrUnknownSource);
    expect(screen.queryByText('LEGACY_OR_UNKNOWN')).not.toBeInTheDocument();
  });

  it('renders a "more alerts exist" notice when alerts.hasMore is true (issue 5), and nothing extra when false', () => {
    const { rerender } = render(
      <SupportSnapshotPanels
        snapshot={{
          ...BASE_SNAPSHOT,
          alerts: { items: [{ id: 'a1', kind: 'DRIFT_REPAIR', severity: 'INFO', createdAt: Date.now(), detail: null }], hasMore: true }
        }}
      />
    );
    expect(screen.getByTestId('support-alerts-has-more')).toHaveTextContent(strings.support.moreAlertsExist);

    rerender(
      <SupportSnapshotPanels
        snapshot={{
          ...BASE_SNAPSHOT,
          alerts: { items: [{ id: 'a1', kind: 'DRIFT_REPAIR', severity: 'INFO', createdAt: Date.now(), detail: null }], hasMore: false }
        }}
      />
    );
    expect(screen.queryByTestId('support-alerts-has-more')).not.toBeInTheDocument();
  });
});
