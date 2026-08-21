/**
 * Ops alert emitter (Payment Ecosystem Hardening plan). Started as a Phase 7 prerequisite so the
 * drift-repair mechanisms (`subscriptions/scheduledRazorpayDriftSweep.js`,
 * `subscriptions/repairMobileEntitlement.js`) had somewhere to signal "I just repaired a stranded
 * paying customer" / "a client tried to claim an entitlement RevenueCat doesn't confirm" the
 * moment they shipped, rather than that evidence vanishing into Cloud Logging with nobody
 * subscribed. Phase 8 ("One alert destination") extended it to the whole system -- reconciliation
 * corrections, both webhooks' `conflictDetectedAt` writes, and webhook signature failures all go
 * through the same `ALERT_KINDS` map and the same two sinks (`ops_alerts` doc + labelled
 * `console.error`) -- and provisioned the delivery channel that actually turns these log lines
 * into a human notification: `functions/scripts/set-ops-alerting.js` creates the Cloud Monitoring
 * log-based metric, email notification channel, and alert policy, as code, idempotently.
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
  DRIFT_CONFLICT: 'DRIFT_CONFLICT',
  /** Phase 8: `scheduledSubscriptionReconciliation`'s downward sweep downgraded one or more stale
   * docs this run -- each correction is itself evidence a webhook was missed (M2's original
   * framing: this cron's corrections were the intended signal, and until now nothing read them). */
  RECONCILIATION_CORRECTION: 'RECONCILIATION_CORRECTION',
  /** Phase 8: `revenueCatWebhook.js`/`lib/razorpaySubscriptionWebhook.js`'s `resolveReconciliation`
   * detected a cross-platform conflict (both an active RevenueCat and an active Razorpay
   * subscription for the same user) and refused to silently overwrite -- this is what actually
   * closes M2 for the `conflictDetectedAt` writes, which were previously read by nothing. */
  WEBHOOK_RECONCILIATION_CONFLICT: 'WEBHOOK_RECONCILIATION_CONFLICT',
  /** Phase 8: a Razorpay or RevenueCat webhook request failed HMAC signature verification -- either
   * a misconfigured secret (every legitimate webhook would then fail) or a forged request. */
  SIGNATURE_VERIFICATION_FAILED: 'SIGNATURE_VERIFICATION_FAILED',
  /** Phase 8: `functions/scripts/set-ops-alerting.js --smoke` -- never emitted by production code.
   * Exists so a human can confirm the whole pipeline (log line -> log-based metric -> alert policy
   * -> notification channel -> inbox) actually delivers, end to end, not just "the objects exist". */
  SYNTHETIC_PROBE: 'SYNTHETIC_PROBE',
  /** Phase 11 (M2): the reconciliation cron's own periodic sweep found a subscription doc still
   * carrying an unresolved `conflictDetectedAt` -- distinct from `WEBHOOK_RECONCILIATION_CONFLICT`
   * (fired once, at the moment a webhook first detects the conflict) because this one fires on
   * every sweep the conflict remains unresolved, which is the actual signal a human missed the
   * first alert. */
  UNRESOLVED_SUBSCRIPTION_CONFLICT: 'UNRESOLVED_SUBSCRIPTION_CONFLICT',
  /** Phase 11 (M5): a Razorpay webhook request carried no stable event id (`event_id` field or
   * `x-razorpay-event-id` header) -- rejected rather than processed under an invented id, since an
   * invented id can never dedupe a retry of the same event. */
  MISSING_WEBHOOK_EVENT_ID: 'MISSING_WEBHOOK_EVENT_ID'
});

const SEVERITIES = Object.freeze({ INFO: 'INFO', HIGH: 'HIGH', CRITICAL: 'CRITICAL' });

// Phase 8: best-effort spam guard, deliberately thin (Rule 2 -- no new Firestore collection, no
// second round-trip before every alert). Keyed per warm function instance only -- it will NOT
// dedupe an identical alert fired from two concurrent instances (Cloud Functions gives each
// instance its own module scope), so this is not an exactness guarantee. It exists to stop the
// pathological single-instance case the plan calls out by name: a webhook signature failure
// hammered in a tight retry loop, or a reconciliation run correcting thousands of docs in one
// invocation, from writing thousands of `ops_alerts` docs / emitting thousands of emails. The
// durable, cross-instance line of defense is Cloud Monitoring's own rolling-window alert policy
// (`set-ops-alerting.js`), which coalesces by `alertKind` regardless of how many log lines land --
// this in-memory guard only keeps the Firestore side (and this instance's log volume) sane.
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const recentAlertsAt = new Map();

function dedupeKey(kind, userId) {
  return `${kind}:${userId ?? 'GLOBAL'}`;
}

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
  const key = dedupeKey(kind, userId);
  const now = Date.now();
  const lastSentAt = recentAlertsAt.get(key);
  const suppressed = lastSentAt != null && now - lastSentAt < DEDUPE_WINDOW_MS;

  if (!suppressed) {
    recentAlertsAt.set(key, now);
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
  }

  console.error(
    `[ops_alert]${suppressed ? ' suppressed=dedupe' : ''} kind=${kind} severity=${severity} userHash=${userId != null ? hashUserId(userId) : 'n/a'} detail=${JSON.stringify(detail || {})}`
  );
}

/** Test-only: clears the in-memory dedupe state. Without this, two unrelated tests in the same
 * file/process that happen to emit the same (kind, userId) pair -- e.g. two GLOBAL-keyed alerts
 * with no userId, like RECONCILIATION_CORRECTION or SIGNATURE_VERIFICATION_FAILED -- would see the
 * second one silently suppressed by the dedupe window, not because of a bug but because that's
 * exactly what the window is for. Call at the top of any test asserting an alert IS written. Never
 * called from production code. */
function __resetDedupeForTests() {
  recentAlertsAt.clear();
}

module.exports = { emitOpsAlert, ALERT_KINDS, SEVERITIES, hashUserId, DEDUPE_WINDOW_MS, __resetDedupeForTests };
