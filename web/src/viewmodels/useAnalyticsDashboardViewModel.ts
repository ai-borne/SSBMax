import { useEffect, useState } from 'react';
import { AnalyticsRepository, AnalyticsDailySummary } from '../repositories/AnalyticsRepository';

export type AnalyticsDashboardState =
  | { status: 'LOADING' }
  | { status: 'LOADED'; summary: AnalyticsDailySummary }
  | { status: 'ERROR'; message: string; code?: string };

/** Same rationale as useSubscriptionSupportViewModel.ts's extractCode -- httpsCallable rejects
 * with a `FunctionsError` whose `.code` is `"functions/<error-code>"`, distinct from `.message`. */
function extractCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : undefined;
}

export interface UseAnalyticsDashboardViewModelReturn {
  state: AnalyticsDashboardState;
}

/**
 * State-only ViewModel for `AnalyticsDashboardPage.tsx` (Phase 8, ai_search_readiness plan).
 * Unlike `useSubscriptionSupportViewModel` (a support agent types a uid, so `lookup` is
 * user-triggered), there is no query input here -- an admin opening the page always wants the
 * one summary that exists, so it loads on mount.
 */
export function useAnalyticsDashboardViewModel(
  injectedRepository?: AnalyticsRepository
): UseAnalyticsDashboardViewModelReturn {
  const [repository] = useState(() => injectedRepository ?? new AnalyticsRepository());
  const [state, setState] = useState<AnalyticsDashboardState>({ status: 'LOADING' });

  useEffect(() => {
    let cancelled = false;
    repository
      .getAnalyticsSummary()
      .then((summary) => {
        if (!cancelled) setState({ status: 'LOADED', summary });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to load analytics summary',
          code: extractCode(error)
        });
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  return { state };
}
