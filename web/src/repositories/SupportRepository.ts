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
 * (issue 1: "no Razorpay subscription" must not read the same for "never purchased" as for "a
 * legacy doc unverifiable against Razorpay"; issue 4: an unrecognized/missing `source` gets its
 * own label too). */
export type SubscriptionSourceKind = 'RAZORPAY' | 'RAZORPAY_INCOMPLETE' | 'REVENUECAT' | 'LEGACY_OR_UNKNOWN' | 'NONE';

export type SupportSnapshotFirestore = SupportSnapshotSource & { sourceKind?: SubscriptionSourceKind };

/** Phase 10, issue 1: a RAZORPAY-sourced doc with no `subscriptionId` (predates Phase 5's
 * subscriptionId-at-activation write) is unverifiable against the Razorpay API -- tagged distinctly
 * from the plain `null` that means "this user never touched Razorpay at all". */
export type SupportSnapshotRazorpay = SupportSnapshotSource | { dataIncomplete: true; reason: string } | null;

/** Phase 10, issue 5: `{ items, hasMore }` instead of a bare array -- `hasMore` is true when a
 * 21st matching `ops_alerts` doc exists, so a heavily-drifted user's older alerts don't silently
 * look identical to a user who genuinely only has a few. */
export type SupportSnapshotAlerts = { items: SupportSnapshotAlert[]; hasMore: boolean } | { unavailable: true; reason?: string };

/** Phase 10, issue 2: `null` when either source needed for the comparison is `unavailable` --
 * never a false "no conflict" from incomplete data. */
export type SupportSnapshotConflict = { detected: boolean } | null;

export interface SubscriptionSupportSnapshot {
  userId: string;
  firestore: SupportSnapshotFirestore;
  razorpay: SupportSnapshotRazorpay;
  revenueCat: SupportSnapshotSource;
  alerts: SupportSnapshotAlerts;
  conflict: SupportSnapshotConflict;
}

export class SupportRepository {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  getSubscriptionSupportSnapshot = (userId: string): Promise<SubscriptionSupportSnapshot> =>
    httpsCallable<{ userId: string }, SubscriptionSupportSnapshot>(
      this.functionsInstance,
      'getSubscriptionSupportSnapshot'
    )({ userId }).then((r) => r.data);
}
