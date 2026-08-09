// Rules-unit coverage for the `test_sessions` collection in ../firestore.rules.
//
// Why this file exists: the "stuck ACTIVE test_sessions" production incident (see
// CLAUDE.local.md / the commit that fixed PPDT+OIR) happened because the update rule was
// tightened to fix one bug and, in doing so, silently blocked every legitimate retake -- and
// nothing in CI would have caught either version of the mistake before it shipped. This suite
// pins the three legal transitions the rule's own comment documents, plus the illegal
// transitions a future "simplification" could easily reintroduce.
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

const HOUR_MS = 60 * 60 * 1000;

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    // Overridable so the suite can also run against an already-running emulator started
    // in --single_project mode for a different project id.
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

function activeSession(overrides = {}) {
  const now = Date.now();
  return {
    userId: 'user-1',
    testId: 'tat_standard',
    testType: 'TAT',
    startTime: now,
    expiresAt: now + 2 * HOUR_MS,
    isActive: true,
    status: 'ACTIVE',
    ...overrides
  };
}

async function seed(docId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('test_sessions').doc(docId).set(data);
  });
}

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test('an ACTIVE session may transition to a terminal status (submit)', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('test_sessions').doc(docId).update({
      isActive: false,
      status: 'SUBMITTED'
    })
  );
});

test('a terminal session may start a fresh attempt (retake)', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession({ isActive: false, status: 'SUBMITTED' }));
  const db = testEnv.authenticatedContext('user-1').firestore();
  const now = Date.now();

  await assertSucceeds(
    db.collection('test_sessions').doc(docId).update({
      isActive: true,
      status: 'ACTIVE',
      startTime: now,
      expiresAt: now + 2 * HOUR_MS
    })
  );
});

test('an expired ACTIVE session may be reclaimed by a fresh attempt', async () => {
  // Regression case for the actual incident: client never called abandonTestSession on some
  // exit path, so the doc is stuck ACTIVE past its own expiresAt.
  const docId = 'user-1_tat_standard';
  const now = Date.now();
  await seed(docId, activeSession({ expiresAt: now - HOUR_MS }));
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('test_sessions').doc(docId).update({
      isActive: true,
      status: 'ACTIVE',
      startTime: now,
      expiresAt: now + 2 * HOUR_MS
    })
  );
});

test('the owner may restart over their own still-live ACTIVE session', async () => {
  // Second half of the incident, and the reason this is ALLOWED rather than denied: the doc
  // gets stuck ACTIVE well before its expiresAt whenever a load fails after the session write
  // or the process dies mid-test. Denying the owner here bought no security -- they already
  // hold the ACTIVE session that grants test_questions read -- and instead locked them out of
  // their own test for two hours behind a "check your internet connection" error.
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.authenticatedContext('user-1').firestore();
  const now = Date.now();

  await assertSucceeds(
    db.collection('test_sessions').doc(docId).update({
      isActive: true,
      status: 'ACTIVE',
      startTime: now,
      expiresAt: now + 2 * HOUR_MS
    })
  );
});

test('createTestSession\'s full-document replace over a stuck ACTIVE doc is allowed', async () => {
  // Exercises the real production write rather than a field-wise update(): GitLive's
  // createTestSession() issues set() with the complete TestSessionDto (including `id`, and
  // dropping any `endTime` a previous abandon wrote). This is the write that returned
  // PERMISSION_DENIED on device for both PPDT and OIR.
  const docId = 'user-1_tat_standard';
  const now = Date.now();
  await seed(docId, activeSession({ startTime: now - HOUR_MS, expiresAt: now + HOUR_MS }));
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('test_sessions').doc(docId).set({
      id: docId,
      userId: 'user-1',
      testId: 'tat_standard',
      testType: 'TAT',
      startTime: now,
      expiresAt: now + 2 * HOUR_MS,
      isActive: true,
      status: 'ACTIVE'
    })
  );
});

test('a restart cannot masquerade as a terminal session going terminal again', async () => {
  // The transition whitelist still has to hold: a write that is neither "going terminal from
  // ACTIVE" nor "coming back up as ACTIVE" is not a legal shape for this doc.
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession({ isActive: false, status: 'SUBMITTED' }));
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('test_sessions').doc(docId).update({
      isActive: false,
      status: 'ABANDONED'
    })
  );
});

test('another user cannot update someone else\'s session', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.authenticatedContext('user-2').firestore();

  await assertFails(
    db.collection('test_sessions').doc(docId).update({
      isActive: false,
      status: 'SUBMITTED'
    })
  );
});

test('userId, testId, and testType are immutable on update', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('test_sessions').doc(docId).update({
      isActive: false,
      status: 'SUBMITTED',
      testType: 'WAT'
    })
  );
});

test('an unauthenticated client cannot update a session', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(
    db.collection('test_sessions').doc(docId).update({
      isActive: false,
      status: 'SUBMITTED'
    })
  );
});

test('a client cannot create a session with someone else\'s userId', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();
  const now = Date.now();

  await assertFails(
    db.collection('test_sessions').doc('user-1_tat_standard').set({
      userId: 'user-2',
      testId: 'tat_standard',
      testType: 'TAT',
      startTime: now,
      expiresAt: now + 2 * HOUR_MS,
      isActive: true,
      status: 'ACTIVE'
    })
  );
});

test('a client cannot delete a session', async () => {
  const docId = 'user-1_tat_standard';
  await seed(docId, activeSession());
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(db.collection('test_sessions').doc(docId).delete());
});
