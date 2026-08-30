/**
 * Phase 8 (ai_search_readiness plan): copy for `AnalyticsDashboardPage.tsx`, the admin-only
 * measurement dashboard. Its own domain file, matching support.ts's precedent for a new,
 * fully-separate admin UI domain.
 */
export const analyticsStrings = {
  title: 'GEO Measurement Dashboard',
  subtitle:
    'Admin-only: signup counts since instrumentation shipped. Traffic and AI-referrer segmentation (chatgpt.com / perplexity.ai / claude.ai) live in the Cloudflare Web Analytics dashboard, not here -- see docs/plans/ai_search_readiness_phase8_measurement.md.',
  loading: 'Loading...',
  totalSignupsLabel: 'Total signups recorded',
  sinceLabel: 'Since',
  noDataYet: 'No signups recorded yet. This dashboard only shows data from when instrumentation shipped forward -- there is no historical baseline to compare against.',
  dailyBreakdownTitle: 'Daily signups',
  permissionDenied: 'Admin access required to view this dashboard.',
  genericError: 'Failed to load the analytics summary. Please try again.'
} as const;
