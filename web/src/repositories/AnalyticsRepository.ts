/**
 * Analytics Repository (Phase 8, ai_search_readiness plan -- "Measurement & Instrumentation").
 * Single Responsibility: calls the two `functions/src/analytics/*.js` callables -- no Firestore
 * access, matching web/CLAUDE.md's rule that repositories are the only place touching Firestore
 * or Cloud Functions.
 *
 * Deliberately two thin methods, not a general event-logging API: `recordSignup` fires once from
 * `AuthService` right after a real new sign-in, and `getAnalyticsSummary` feeds the admin-only
 * dashboard. See `functions/src/analytics/recordSignup.js`'s doc comment for why traffic/referrer
 * segmentation is NOT part of this repository -- that lives in Cloudflare Web Analytics instead.
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface AnalyticsDailySummary {
  days: { date: string; signups: number }[];
  totalSignups: number;
  sinceDate: string | null;
}

export class AnalyticsRepository {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  recordSignup = (): Promise<void> =>
    httpsCallable<void, { date: string }>(this.functionsInstance, 'recordSignup')().then(() => undefined);

  getAnalyticsSummary = (): Promise<AnalyticsDailySummary> =>
    httpsCallable<void, AnalyticsDailySummary>(this.functionsInstance, 'getAnalyticsSummary')().then((r) => r.data);
}
