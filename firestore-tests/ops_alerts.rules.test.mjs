// Rules-unit coverage for /ops_alerts/{alertId} in ../firestore.rules (Phase 8, Payment Ecosystem
// Hardening plan, "One alert destination").
//
// `functions/src/lib/opsAlert.js`'s `emitOpsAlert` writes the real (unhashed) userId into this
// collection -- deliberately, so Phase 9's admin-gated support view can join it against a
// Firestore/Razorpay/RevenueCat lookup. That's only safe because the collection is server-only:
// the Admin SDK bypasses these rules entirely, and no client SDK path may ever read or write it.
// A support console any signed-in user could read would be the exact class of mistake C1 (Phase 1)
// closed for `data/subscription` -- additive rules make "obviously denied" wrong more often than
// you'd expect, so this is pinned the same way that fix was.
//
// Run via `firebase emulators:exec --only firestore "npm --prefix firestore-tests test"` --
// requires the emulator listening on 127.0.0.1:8080 (see ../firebase.json).

import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails
} from '@firebase/rules-unit-testing';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.RULES_TEST_PROJECT_ID || 'demo-ssbmax-rules-test',
    firestore: {
      rules: readFileSync('../firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

function alertDoc(overrides = {}) {
  return {
    kind: 'DRIFT_REPAIR',
    severity: 'INFO',
    userId: 'user-1',
    detail: {},
    createdAt: Date.now(),
    ...overrides
  };
}

function seedAlert(alertId = 'alert-1', overrides = {}) {
  return testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('ops_alerts').doc(alertId).set(alertDoc(overrides));
  });
}

test('a signed-in client cannot read ops_alerts, even their own userId\'s alert', async () => {
  await seedAlert('alert-1', { userId: 'user-1' });
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('ops_alerts').doc('alert-1').get());
});

test('a signed-in client cannot list ops_alerts', async () => {
  await seedAlert('alert-1', { userId: 'user-1' });
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('ops_alerts').get());
});

test('a signed-in client cannot create an ops_alerts doc (no forging a fake alert to hide a real one behind noise)', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('ops_alerts').doc('forged').set(alertDoc()));
});

test('a signed-in client cannot write to an existing ops_alerts doc', async () => {
  await seedAlert('alert-1');
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('ops_alerts').doc('alert-1').update({ severity: 'INFO' }));
});

test('an unauthenticated client cannot read or write ops_alerts', async () => {
  await seedAlert('alert-1');
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(db.collection('ops_alerts').doc('alert-1').get());
  await assertFails(db.collection('ops_alerts').doc('forged').set(alertDoc()));
});
