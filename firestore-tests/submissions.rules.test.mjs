// Rules-unit coverage for the OIR branch of `submissions/{submissionId}`'s create rule in
// ../firestore.rules.
//
// Why this file exists: OIR Retake Seal Phase 1 (see docs/plans/OIR_Retake_Seal_Execution_Plan.md)
// changed SubmitOIRTestUseCase to mint a fresh, random submission id per attempt instead of
// reusing `session.sessionId` as the submission doc id. The submissions create rule's OIR branch
// was never updated to match: it still checks
//   exists(/databases/$(database)/documents/test_sessions/$(request.resource.id))
// -- i.e. it looks for a test_sessions doc whose id equals the *submission's own* id. That
// assumption held when submissionId == sessionId; after Phase 1 it never holds, for ANY OIR
// submission (not just retakes) -- request.resource.id is now a random UUID, so the exists()
// check always fails and every OIR submission create is denied with PERMISSION_DENIED. Phase 4
// of that plan exists to catch exactly this: it changes the identity-conflict guard from an
// `update`-shaped mental model to a `create`-per-attempt one, and this file is where that gets
// pinned. The real write shape (root/data/data.testResult field names) is read from
// data-firebase/.../OIRSubmissionMappers.kt and GitLivePersonalTestSubmissionRepository.kt --
// don't guess it, see PPDT_Pipeline.md §25 Step 2.
//
// Run via `firebase emulators:exec --only firestore "npm --prefix firestore-tests test"` --
// requires the emulator listening on 127.0.0.1:8080 (see ../firebase.json).

import { test, before, after } from 'node:test';
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

async function seedSession(docId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('test_sessions').doc(docId).set({
      userId: 'user-1',
      testId: 'oir_standard',
      testType: 'OIR',
      startTime: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      isActive: false,
      status: 'SUBMITTED',
      ...overrides
    });
  });
}

// Mirrors GitLivePersonalTestSubmissionRepository.submitOIR's real write shape: root-level
// identity fields plus a nested `data.testResult.sessionId` carrying the durable session id
// (OIRSubmissionMappers.kt's OIRDataDto/OIRSubmissionTestResultDto).
function oirSubmissionDoc(submissionId, sessionId, overrides = {}) {
  return {
    id: submissionId,
    userId: 'user-1',
    testId: 'oir_standard',
    testType: 'OIR',
    status: 'SUBMITTED_PENDING_REVIEW',
    submittedAt: Date.now(),
    data: {
      id: submissionId,
      userId: 'user-1',
      testId: 'oir_standard',
      testResult: {
        testId: 'oir_standard',
        sessionId,
        userId: 'user-1',
        totalQuestions: 50,
        correctAnswers: 30,
        rawScore: 30,
        percentageScore: 60.0
      },
      submittedAt: Date.now(),
      status: 'SUBMITTED_PENDING_REVIEW'
    },
    ...overrides
  };
}

test('a first OIR submission under a fresh, session-decoupled id succeeds under the create rule', async () => {
  // Regression guard for the actual defect: after Phase 1, submissionId is always a random UUID,
  // never session.sessionId -- so this is not retake-specific, it is every OIR submission.
  const sessionId = 'user-1_oir_standard';
  await seedSession(sessionId);
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('submissions').doc('fresh-submission-1')
      .set(oirSubmissionDoc('fresh-submission-1', sessionId))
  );
});

test('a retake creates a second, distinct OIR submission doc against the same test_sessions doc', async () => {
  // The core Phase 4 seal check: two attempts against ONE reused session doc must both be legal
  // creates (never an update/overwrite), per Option B (docs/plans/OIR_Retake_Seal_Execution_Plan.md §2).
  const sessionId = 'user-1_oir_standard';
  await seedSession(sessionId);
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('submissions').doc('attempt-1').set(oirSubmissionDoc('attempt-1', sessionId))
  );
  await assertSucceeds(
    db.collection('submissions').doc('attempt-2').set(oirSubmissionDoc('attempt-2', sessionId))
  );
});

test('an OIR submission whose sessionId points to a non-existent test_sessions doc is rejected', async () => {
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('submissions').doc('fresh-submission-1')
      .set(oirSubmissionDoc('fresh-submission-1', 'user-1_oir_standard'))
  );
});

test('an OIR submission whose sessionId points to another user\'s session is rejected', async () => {
  const sessionId = 'user-2_oir_standard';
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('test_sessions').doc(sessionId).set({
      userId: 'user-2',
      testId: 'oir_standard',
      testType: 'OIR',
      startTime: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      isActive: false,
      status: 'SUBMITTED'
    });
  });
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('submissions').doc('fresh-submission-1')
      .set(oirSubmissionDoc('fresh-submission-1', sessionId))
  );
});

test('an OIR submission whose sessionId points to a wrong-test-type session is rejected', async () => {
  const sessionId = 'user-1_tat_standard';
  await seedSession(sessionId, { testId: 'tat_standard', testType: 'TAT' });
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('submissions').doc('fresh-submission-1')
      .set(oirSubmissionDoc('fresh-submission-1', sessionId))
  );
});
