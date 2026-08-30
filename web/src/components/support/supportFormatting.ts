/**
 * Phase 10 (Payment Ecosystem Hardening plan), issue 3: every known timestamp field in the
 * support snapshot (`expiryDate`, `startDate`, `createdAt`) rendered as a raw epoch-millis number
 * an agent had to mentally convert. Small exported pure function living beside the component that
 * uses it, mirroring `useSubscriptionOwnership.ts`'s precedent, rather than a ViewModel method --
 * this is pure formatting, not state.
 */
export function formatSupportTimestamp(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  return new Date(value).toLocaleString();
}

/** Known timestamp-valued keys across the joined snapshot's sources -- the panel formats these,
 * everything else renders as-is. */
export const SUPPORT_TIMESTAMP_KEYS = new Set(['expiryDate', 'startDate', 'createdAt']);
