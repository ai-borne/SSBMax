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

/** Any of the three joined sources may degrade to `{ unavailable: true }` instead of throwing --
 * see the callable's doc comment for why. */
export type SupportSnapshotSource = { unavailable: true; reason?: string } | Record<string, unknown>;

export interface SubscriptionSupportSnapshot {
  userId: string;
  firestore: SupportSnapshotSource;
  razorpay: SupportSnapshotSource | null;
  revenueCat: SupportSnapshotSource;
  alerts: SupportSnapshotAlert[];
}

export class SupportRepository {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  getSubscriptionSupportSnapshot = (userId: string): Promise<SubscriptionSupportSnapshot> =>
    httpsCallable<{ userId: string }, SubscriptionSupportSnapshot>(
      this.functionsInstance,
      'getSubscriptionSupportSnapshot'
    )({ userId }).then((r) => r.data);
}
