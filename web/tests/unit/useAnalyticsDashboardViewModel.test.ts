import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAnalyticsDashboardViewModel } from '../../src/viewmodels/useAnalyticsDashboardViewModel';
import type { AnalyticsDailySummary } from '../../src/repositories/AnalyticsRepository';

function mockRepository(overrides: Partial<Record<string, any>> = {}) {
  return {
    getAnalyticsSummary: vi.fn(),
    ...overrides
  } as any;
}

const SUMMARY: AnalyticsDailySummary = {
  days: [{ date: '2026-08-29', signups: 3 }],
  totalSignups: 3,
  sinceDate: '2026-08-29'
};

/**
 * Phase 8 (ai_search_readiness plan): unlike useSubscriptionSupportViewModel (a support agent
 * types a uid, so the fetch is user-triggered), an admin opening the dashboard always wants the
 * one summary that exists -- so this loads on mount, and the test pins that behavior.
 */
describe('useAnalyticsDashboardViewModel', () => {
  it('starts LOADING and calls the repository immediately on mount', () => {
    const repository = mockRepository({ getAnalyticsSummary: vi.fn(() => new Promise(() => {})) });
    const { result } = renderHook(() => useAnalyticsDashboardViewModel(repository));

    expect(result.current.state).toEqual({ status: 'LOADING' });
    expect(repository.getAnalyticsSummary).toHaveBeenCalledTimes(1);
  });

  it('transitions LOADING -> LOADED with the resolved summary', async () => {
    const repository = mockRepository({ getAnalyticsSummary: vi.fn().mockResolvedValue(SUMMARY) });
    const { result } = renderHook(() => useAnalyticsDashboardViewModel(repository));

    await waitFor(() => expect(result.current.state.status).toBe('LOADED'));
    expect(result.current.state).toEqual({ status: 'LOADED', summary: SUMMARY });
  });

  it('transitions to ERROR carrying both message and code when the callable rejects (e.g. a non-admin caller)', async () => {
    const error = Object.assign(new Error('Admin access required'), { code: 'functions/permission-denied' });
    const repository = mockRepository({ getAnalyticsSummary: vi.fn().mockRejectedValue(error) });
    const { result } = renderHook(() => useAnalyticsDashboardViewModel(repository));

    await waitFor(() => expect(result.current.state.status).toBe('ERROR'));
    expect(result.current.state).toEqual({ status: 'ERROR', message: 'Admin access required', code: 'functions/permission-denied' });
  });

  it('does not update state after unmount (no act() warning from a late-resolving promise)', async () => {
    let resolveSummary: (value: AnalyticsDailySummary) => void = () => {};
    const pending = new Promise<AnalyticsDailySummary>((resolve) => {
      resolveSummary = resolve;
    });
    const repository = mockRepository({ getAnalyticsSummary: vi.fn().mockReturnValue(pending) });
    const { result, unmount } = renderHook(() => useAnalyticsDashboardViewModel(repository));

    unmount();
    resolveSummary(SUMMARY);
    await pending;

    expect(result.current.state).toEqual({ status: 'LOADING' });
  });
});
