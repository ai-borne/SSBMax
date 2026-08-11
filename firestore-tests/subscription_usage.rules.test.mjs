// Rules-unit coverage for users/{userId}/subscription/{month} in ../firestore.rules.
//
// Phase 5 (docs/plans/CrossPlatform_SSOT): the recordTestUsage callable Cloud Function
// (functions/src/eligibility.js, Admin SDK) became the sole writer of usage_{month} docs,
// closing the "clear app cache to reset quota" bypass the old client-writable
// increment-by-one rules still nominally allowed. This file used to pin that clients COULD
// write usage docs directly (see git history for the pre-Phase-5 version); it now pins the
// opposite -- clients can read their own usage but cannot write it at all, from any shape.
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

test('a client cannot create a usage doc directly, even a well-formed one', async () => {
  // Pre-Phase-5 this succeeded (the real GitLiveTestUsageRecorder write shape). Now only the
  // recordTestUsage callable (Admin SDK, bypasses rules) may create this doc.
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08')
      .set(freshUsageDoc())
  );
});

test('a client cannot update an existing usage doc, even by exactly one attempt', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').update({
      ppdtTestsUsed: 2,
      lastUpdated: Date.now(),
      recordedSubmissionIds: ['submission-1', 'submission-2']
    })
  );
});

test('a client cannot delete a usage doc', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').delete()
  );
});

test('a user can still read their own usage doc (optimistic UX check survives the lockdown)', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertSucceeds(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').get()
  );
});

test('a client cannot read another user\'s usage doc', async () => {
  const db = testEnv.authenticatedContext('user-2').firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('user-1').collection('subscription')
      .doc('usage_2026-08').set(freshUsageDoc());
  });

  await assertFails(
    db.collection('users').doc('user-1').collection('subscription').doc('usage_2026-08').get()
  );
});
