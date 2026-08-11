// Rules-unit coverage for feature_flags/{document} in ../firestore.rules.
//
// Phase 8 (docs/plans/CrossPlatform_SSOT): this is the one collection in the whole rules
// file with public (unauthenticated) read -- the remote kill-switch it drives must be
// readable before a user has signed in, since the splash/login screens are themselves
// gated by it. Deny-all write always, from every caller including the doc's owner-less
// nature -- only Cloud Functions/ops scripts (Admin SDK, bypasses rules) may write it.
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

async function seedConfig() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('feature_flags').doc('config').set({
      minimumSupportedAppVersion: '1.0.0',
      flags: {}
    });
  });
}

test('an unauthenticated client can read feature_flags/config', async () => {
  await seedConfig();
  const db = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(db.collection('feature_flags').doc('config').get());
});

test('an authenticated client can also read feature_flags/config', async () => {
  await seedConfig();
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(db.collection('feature_flags').doc('config').get());
});

test('a client cannot create feature_flags/config', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('feature_flags').doc('config').set({ minimumSupportedAppVersion: '99.0.0', flags: {} })
  );
});

test('a client cannot update feature_flags/config', async () => {
  await seedConfig();
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('feature_flags').doc('config').update({ minimumSupportedAppVersion: '99.0.0' }));
});

test('a client cannot delete feature_flags/config', async () => {
  await seedConfig();
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('feature_flags').doc('config').delete());
});
