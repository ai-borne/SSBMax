import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { httpsCallable } from 'firebase/functions';
import { AnalyticsDashboardPage } from '../../../src/components/analytics/AnalyticsDashboardPage';
import { strings } from '../../../src/constants/strings';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * Phase 8 (ai_search_readiness plan). Same permission-denied-via-.code pinning as
 * SupportSubscriptionPage.test.tsx -- httpsCallable's FunctionsError carries the code on
 * `.code`, not `.message`.
 */
describe('AnalyticsDashboardPage', () => {
  it('renders the loading state before the callable resolves', () => {
    vi.mocked(httpsCallable).mockReturnValue(vi.fn(() => new Promise(() => {})) as any);

    render(<AnalyticsDashboardPage />);

    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument();
  });

  it('renders the admin-facing permission-denied copy when the callable rejects with functions/permission-denied', async () => {
    const error = Object.assign(new Error('Admin access required'), { code: 'functions/permission-denied' });
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as any);

    render(<AnalyticsDashboardPage />);

    await waitFor(() => expect(screen.getByTestId('analytics-error')).toHaveTextContent(strings.analytics.permissionDenied));
  });

  it('renders the generic error copy for any other failure', async () => {
    const error = Object.assign(new Error('boom'), { code: 'functions/internal' });
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as any);

    render(<AnalyticsDashboardPage />);

    await waitFor(() => expect(screen.getByTestId('analytics-error')).toHaveTextContent(strings.analytics.genericError));
  });

  it('renders the "no data yet" copy when no day docs exist', async () => {
    vi.mocked(httpsCallable).mockReturnValue(
      vi.fn().mockResolvedValue({ data: { days: [], totalSignups: 0, sinceDate: null } }) as any
    );

    render(<AnalyticsDashboardPage />);

    await waitFor(() => expect(screen.getByTestId('analytics-no-data')).toHaveTextContent(strings.analytics.noDataYet));
  });

  it('renders the total signup count and the daily breakdown table on a successful load', async () => {
    const summary = {
      days: [
        { date: '2026-08-28', signups: 2 },
        { date: '2026-08-29', signups: 5 }
      ],
      totalSignups: 7,
      sinceDate: '2026-08-28'
    };
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue({ data: summary }) as any);

    render(<AnalyticsDashboardPage />);

    await waitFor(() => expect(screen.getByTestId('analytics-total-signups')).toHaveTextContent('7'));
    expect(screen.getByTestId('analytics-daily-table')).toHaveTextContent('2026-08-28');
    expect(screen.getByTestId('analytics-daily-table')).toHaveTextContent('2026-08-29');
    expect(screen.queryByTestId('analytics-error')).not.toBeInTheDocument();
  });
});
