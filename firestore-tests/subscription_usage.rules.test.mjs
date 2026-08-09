// Rules-unit coverage for users/{userId}/subscription/{month} in ../firestore.rules.
//
// Why this file exists: commit d6abd123 ("harden idempotent submission and quota integrity")
// added `request.resource.data.month == document` to the create rule, comparing the `month`
// field (bare value, e.g. "2026-08" -- see GitLiveTestUsageRecorder/GitLiveSubscriptionRepository)
// against `document`, which is the doc id ("usage_2026-08"). The two can never be equal, so
// every user's first usage write of every month was denied -- which, because
// SubmitPPDTTestUseCase/SubmitOIRTestUseCase call recordTestUsage() after the submission write
// and propagate its exception through runCatching, made EVERY test submission report failure to
// the user (even though the submission document itself had already persisted) and silently
// skipped the OLQ analysis trigger, which only runs in the ViewModel's onSuccess branch.
//
// Run via `firebase emulators:exec --only firestore "npm --prefix firestore-tests test"` --
// requires the emulator listening on 127.0.0.1:8080 (see ../firebase.json).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
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

function freshUsageDoc(overrides = {}) {
  return {
    userId: 'user-1',
    month: '2026-08',
    oirTestsUsed: 0,
    tatTestsUsed: 0,
    watTestsUsed: 0,
    srtTestsUsed: 0,
    ppdtTestsUsed: 1,
    piqTestsUsed: 0,
    gtoTestsUsed: 0,
    interviewTestsUsed: 0,
    sdTestsUsed: 0,
    recordedSubmissionIds: ['submission-1'],
    lastUpdated: Date.now(),
    ...overrides
  };
}

test('the real write shape (bare month field, usage_-prefixed doc id) is allowed', async () => {
  // This is GitLiveTestUsageRecorder.recordTestUsage()'s actual first-write-of-the-month
  // transaction shape. Regression guard for the exact incident: this used to be denied.
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08')
      .set(freshUsageDoc())
  );
});

test('a doc id that does not match usage_{month} is rejected', async () => {
  // The bug was fixed by reconstructing the doc id from the field, not by dropping the check
  // entirely -- a mismatched id/field pair (a client bug, or a forged month field) must still
  // be denied.
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-09')
      .set(freshUsageDoc({ month: '2026-08' }))
  );
});

test('a client cannot create a usage doc for another user', async () => {
  const db = testEnv.authenticatedContext('user-2').firestore();

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08')
      .set(freshUsageDoc())
  );
});

test('an existing usage doc accepts an incremental update recording one more submission', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertSucceeds(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').update({
      ppdtTestsUsed: 2,
      lastUpdated: Date.now(),
      recordedSubmissionIds: ['submission-1', 'submission-2']
    })
  );
});

test('an update cannot jump a counter by more than one attempt', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').update({
      ppdtTestsUsed: 5,
      lastUpdated: Date.now(),
      recordedSubmissionIds: ['submission-1', 'submission-2']
    })
  );
});
