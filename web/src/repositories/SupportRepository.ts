/**
 * Support Repository
 * Single Responsibility: calls the server-side `getSubscriptionSupportSnapshot` Cloud Function
 * (`functions/src/subscriptions/getSubscriptionSupportSnapshot.js`) -- callable invocation only,
 * no Firestore access (web/CLAUDE.md: repositories are the only place that touches Firestore or
 * Cloud Functions; this one never opens a Firestore SDK connection because the callable is
 * admin-gated server-side and this tool must have no client-side read/write path of its own).
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface SupportSnapshotAlert {
  id: string;
  kind: string;
  severity: string;
  createdAt: number;
  detail: Record<string, unknown> | null;
}

/** Any of the four joined sources may degrade to `{ unavailable: true }` instead of throwing --
 * see the callable's doc comment for why. Alerts is no exception: `readRecentAlerts` degrades the
 * same way on a Firestore query failure (e.g. a missing composite index), so the ops_alerts field
 * is a union, not always an array -- a caller that assumes otherwise crashes on exactly the outage
 * this shape exists to survive. */
export type SupportSnapshotSource = { unavailable: true; reason?: string } | Record<string, unknown>;

/** Phase 10: `functions/src/lib/subscriptionSourceClassification.js`'s taxonomy, mirrored here so
 * the panel can render a distinct message per tag instead of falling through to a generic dump
 * (a legacy `RAZORPAY` doc must not read the same as "never purchased"; an unrecognized/missing
 * `source` gets its own label too). */
export type SubscriptionSourceKind = 'LEGACY_RAZORPAY' | 'REVENUECAT' | 'LEGACY_OR_UNKNOWN' | 'NONE';

export type SupportSnapshotFirestore = SupportSnapshotSource & { sourceKind?: SubscriptionSourceKind };

/** Phase 10, issue 5: `{ items, hasMore }` instead of a bare array -- `hasMore` is true when a
 * 21st matching `ops_alerts` doc exists, so a heavily-drifted user's older alerts don't silently
 * look identical to a user who genuinely only has a few. */
export type SupportSnapshotAlerts = { items: SupportSnapshotAlert[]; hasMore: boolean } | { unavailable: true; reason?: string };

export interface SubscriptionSupportSnapshot {
  userId: string;
  firestore: SupportSnapshotFirestore;
  revenueCat: SupportSnapshotSource;
  alerts: SupportSnapshotAlerts;
}

export class SupportRepository {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  getSubscriptionSupportSnapshot = (userId: string): Promise<SubscriptionSupportSnapshot> =>
    httpsCallable<{ userId: string }, SubscriptionSupportSnapshot>(
      this.functionsInstance,
      'getSubscriptionSupportSnapshot'
    )({ userId }).then((r) => r.data);
}
