import { FC } from 'react';
import { strings } from '../../constants/strings';
import { useAnalyticsDashboardViewModel } from '../../viewmodels/useAnalyticsDashboardViewModel';

/**
 * Phase 8 (ai_search_readiness plan, "Measurement & Instrumentation"): the signup half of the
 * plan's exit gate -- "a dashboard/doc showing before-vs-after on traffic, referrals, signups,
 * and AI-visibility". Traffic/referral segmentation and the AI-visibility diagnostic are NOT
 * rebuilt here -- they live in the Cloudflare Web Analytics dashboard and
 * docs/plans/ai_search_readiness_phase8_measurement.md respectively (see this page's subtitle).
 *
 * Same access-control stance as SupportSubscriptionPage.tsx: not reachable from the nav bar
 * (see `App.tsx`/`useTabRouting.ts`'s `analytics` tab), but real enforcement is 100% server-side
 * via the `admin` custom claim checked inside `getAnalyticsSummary` -- a non-admin who finds the
 * URL just sees `strings.analytics.permissionDenied`.
 */
export const AnalyticsDashboardPage: FC = () => {
  const { state } = useAnalyticsDashboardViewModel();

  const errorMessage =
    state.status === 'ERROR'
      ? state.code === 'functions/permission-denied'
        ? strings.analytics.permissionDenied
        : strings.analytics.genericError
      : null;

  return (
    <div className="max-w-3xl w-full mx-auto px-4 py-8 space-y-6" data-testid="analytics-dashboard-page">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{strings.analytics.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{strings.analytics.subtitle}</p>
      </div>

      {state.status === 'LOADING' && (
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="analytics-loading">
          {strings.analytics.loading}
        </p>
      )}

      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" data-testid="analytics-error">
          {errorMessage}
        </p>
      )}

      {state.status === 'LOADED' && (
        <div className="space-y-4" data-testid="analytics-summary">
          {state.summary.days.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="analytics-no-data">
              {strings.analytics.noDataYet}
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-slate-300 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">{strings.analytics.totalSignupsLabel}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100" data-testid="analytics-total-signups">
                  {state.summary.totalSignups}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {strings.analytics.sinceLabel}: {state.summary.sinceDate}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{strings.analytics.dailyBreakdownTitle}</h2>
                <table className="w-full text-sm" data-testid="analytics-daily-table">
                  <tbody>
                    {state.summary.days.map((day) => (
                      <tr key={day.date} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-1.5 text-slate-600 dark:text-slate-300">{day.date}</td>
                        <td className="py-1.5 text-right text-slate-900 dark:text-slate-100">{day.signups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
