/**
 * Ops alert emitter -- minimal Phase 7 prerequisite (Payment Ecosystem Hardening plan). Phase 7's
 * drift-repair mechanisms (`subscriptions/scheduledRazorpayDriftSweep.js`,
 * `subscriptions/repairMobileEntitlement.js`) need somewhere to signal "I just repaired a stranded
 * paying customer" / "a client tried to claim an entitlement RevenueCat doesn't confirm" the
 * moment they ship, rather than that evidence vanishing into Cloud Logging with nobody subscribed
 * -- exactly the gap Phase 8 ("One alert destination") exists to close for the *whole* system
 * (reconciliation corrections, both webhooks' `conflictDetectedAt` writes, signature failures,
 * etc). This file is deliberately the smallest slice of that phase pulled forward: one write sink
 * (`ops_alerts`) and one log line, both already shaped the way Phase 8 specifies, so Phase 7 does
 * not have to invent (and then discard) its own throwaway alerting shape.
 *
 * Phase 8 is expected to extend this file, not replace it: `ALERT_KINDS` grows to cover its
 * additional signals, and `functions/scripts/set-ops-alerting.js` provisions the log-based
 * metric/notification channel/alert policy that actually turns these log lines into a human
 * notification. Until Phase 8 lands, an alert here is queryable in Firestore and visible in Cloud
 * Logging, but nothing is yet subscribed to page anyone -- do not treat this file alone as
 * "monitoring is done."
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths } = require('../generated/contracts.cjs');

/** Frozen kind map (SSOT) -- callers must use these, never a hand-typed string literal, so a
 * future Phase 8 alert-policy filter can never silently drift from what callers actually emit. */
const ALERT_KINDS = Object.freeze({
  /** A drift sweep/repair wrote a higher tier than what was stored -- evidence a webhook was
   * missed for this user. */
  DRIFT_REPAIR: 'DRIFT_REPAIR',
  /** `repairMobileEntitlement` saw a client claim an entitlement RevenueCat does not confirm --
   * the C1-regression guard. No write happened; this alert is the only record that it was tried. */
  DRIFT_REPAIR_REJECTED: 'DRIFT_REPAIR_REJECTED',
  /** `resolveSubscriptionDrift` returned `FLAG_CONFLICT` -- provider and stored disagree in a way
   * that must not be auto-resolved (e.g. a dual mobile+web purchase). */
  DRIFT_CONFLICT: 'DRIFT_CONFLICT'
});

const SEVERITIES = Object.freeze({ INFO: 'INFO', HIGH: 'HIGH', CRITICAL: 'CRITICAL' });

/** Truncated (16 hex chars) SHA-256 of a userId -- enough to correlate repeated alerts for the
 * same user in logs without the log line itself ever carrying the raw id (root CLAUDE.md, "No
 * secrets in logs"). Exported so a future dedupe key (Phase 8) can reuse the exact same hash. */
function hashUserId(userId) {
  return crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 16);
}

/**
 * Writes one `ops_alerts` doc and logs one `console.error` line carrying the hashed (never raw)
 * userId. Never throws into the caller -- alerting must not be able to fail a webhook or a
 * repair callable; a write failure here is itself logged and swallowed, same fail-safe stance as
 * `DefaultRevenueCatClient.logOut`'s fire-and-forget error handling elsewhere in this codebase.
 */
async function emitOpsAlert(firestoreDb, { kind, severity, userId = null, detail = null }) {
  try {
    await firestoreDb.collection(FirestorePaths.OPS_ALERTS).add({
      kind,
      severity,
      userId,
      detail,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (writeError) {
    console.error('emitOpsAlert: failed to write ops_alerts doc', writeError);
  }

  console.error(
    `[ops_alert] kind=${kind} severity=${severity} userHash=${userId != null ? hashUserId(userId) : 'n/a'} detail=${JSON.stringify(detail || {})}`
  );
}

module.exports = { emitOpsAlert, ALERT_KINDS, SEVERITIES, hashUserId };
