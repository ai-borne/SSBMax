/**
 * Phase 8 (Payment Ecosystem Hardening plan, "One alert destination"): tests for
 * `src/lib/opsAlert.js`. `emitOpsAlert` is the single write path every drift-repair, reconciliation
 * and webhook signal goes through -- these tests pin the four properties the phase's design
 * actually depends on: exactly one doc per alert, the PII asymmetry (hashed id in logs, raw id in
 * Firestore), the dedupe window collapsing a burst into one doc, and the never-throws contract that
 * lets every caller `await` it without its own try/catch.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  emitOpsAlert,
  ALERT_KINDS,
  SEVERITIES,
  hashUserId,
  __resetDedupeForTests
} = require('../src/lib/opsAlert');

function makeFakeDb({ failWrite = false } = {}) {
  const opsAlerts = [];
  return {
    collection(name) {
      if (name !== 'ops_alerts') throw new Error(`unexpected collection ${name}`);
      return {
        async add(doc) {
          if (failWrite) throw new Error('simulated Firestore outage');
          opsAlerts.push(doc);
        }
      };
    },
    _opsAlerts: opsAlerts
  };
}

test('emitOpsAlert writes exactly one ops_alerts doc with kind, severity, createdAt, detail', async () => {
  __resetDedupeForTests();
  const db = makeFakeDb();

  await emitOpsAlert(db, {
    kind: ALERT_KINDS.DRIFT_REPAIR,
    severity: SEVERITIES.INFO,
    userId: 'user-1',
    detail: { repairedTier: 'PRO' }
  });

  assert.equal(db._opsAlerts.length, 1);
  const doc = db._opsAlerts[0];
  assert.equal(doc.kind, ALERT_KINDS.DRIFT_REPAIR);
  assert.equal(doc.severity, SEVERITIES.INFO);
  assert.ok('createdAt' in doc);
  assert.deepEqual(doc.detail, { repairedTier: 'PRO' });
});

test('the log line contains the hashed id and not the raw userId (PII guard)', async () => {
  __resetDedupeForTests();
  const db = makeFakeDb();
  const userId = 'a-very-identifiable-real-uid';
  const expectedHash = hashUserId(userId);

  const originalConsoleError = console.error;
  const errorLines = [];
  console.error = (...args) => { errorLines.push(args.join(' ')); };
  try {
    await emitOpsAlert(db, { kind: ALERT_KINDS.DRIFT_CONFLICT, severity: SEVERITIES.HIGH, userId, detail: {} });
  } finally {
    console.error = originalConsoleError;
  }

  const logLine = errorLines.find((line) => line.includes('[ops_alert]'));
  assert.ok(logLine, 'expected an [ops_alert] log line');
  assert.ok(logLine.includes(expectedHash), 'log line must carry the truncated hash for correlation');
  assert.ok(!logLine.includes(userId), 'log line must never carry the raw userId');

  // The asymmetry this test exists to pin: the Firestore doc DOES carry the real id (it's
  // access-controlled server-only, and Phase 9's support view needs it as the join key).
  assert.equal(db._opsAlerts[0].userId, userId);
});

test('a repeated identical alert within the dedupe window writes once, not N times', async () => {
  __resetDedupeForTests();
  const db = makeFakeDb();

  for (let i = 0; i < 5; i++) {
    await emitOpsAlert(db, {
      kind: ALERT_KINDS.SIGNATURE_VERIFICATION_FAILED,
      severity: SEVERITIES.HIGH,
      detail: { attempt: i }
    });
  }

  assert.equal(db._opsAlerts.length, 1, 'a burst of identical alerts must collapse to one Firestore doc');
  assert.deepEqual(db._opsAlerts[0].detail, { attempt: 0 }, 'the first occurrence is what got written');
});

test('a different kind or a different userId is never suppressed by another alert\'s dedupe window', async () => {
  __resetDedupeForTests();
  const db = makeFakeDb();

  await emitOpsAlert(db, { kind: ALERT_KINDS.DRIFT_REPAIR, severity: SEVERITIES.INFO, userId: 'user-a', detail: {} });
  await emitOpsAlert(db, { kind: ALERT_KINDS.DRIFT_CONFLICT, severity: SEVERITIES.HIGH, userId: 'user-a', detail: {} });
  await emitOpsAlert(db, { kind: ALERT_KINDS.DRIFT_REPAIR, severity: SEVERITIES.INFO, userId: 'user-b', detail: {} });

  assert.equal(db._opsAlerts.length, 3, 'different kind/userId combinations are distinct alerts, not a burst');
});

test('emitting an alert never throws into the caller, even when the Firestore write fails', async () => {
  __resetDedupeForTests();
  const db = makeFakeDb({ failWrite: true });

  await assert.doesNotReject(() =>
    emitOpsAlert(db, { kind: ALERT_KINDS.DRIFT_REPAIR_REJECTED, severity: SEVERITIES.HIGH, userId: 'user-1', detail: {} })
  );
  assert.equal(db._opsAlerts.length, 0, 'the failed write left nothing behind, but the call still resolved');
});

test('ALERT_KINDS is frozen -- callers cannot mutate the SSOT kind map', () => {
  assert.ok(Object.isFrozen(ALERT_KINDS));
  ALERT_KINDS.NEW_KIND = 'NEW_KIND'; // no-op in sloppy mode, must not silently succeed
  assert.equal(ALERT_KINDS.NEW_KIND, undefined);
});
