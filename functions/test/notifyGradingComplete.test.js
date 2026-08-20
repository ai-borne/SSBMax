/**
 * Regression coverage for the bug reported live on-device (2026-08-17): TAT's legacy Android
 * WorkManager chain (`TATSynthesisWorker.kt`) finalizes a result and fires a local phone
 * notification, but never wrote the Firestore `notifications/{id}` doc the centralized
 * Notification Center reads from -- unlike WAT/SRT/SD/PPDT, which route through the server
 * `evaluate*` functions that call `notifyEvaluationComplete` automatically. This callable is what
 * `TATSynthesisWorker.kt` now calls itself, right after finalizing locally.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// notifyGradingComplete.js calls admin.initializeApp() at module load if not already
// initialized -- mirrors the pattern every other *.test.js file in this dir relies on already
// having run (onOirSubmissionCreated.js/sendNotification.js do the same guarded init).
const functionsTestModule = require('../src/notifications/notifyGradingComplete');
const { notifyGradingComplete } = functionsTestModule;

function makeContext(uid) {
  return uid ? { auth: { uid } } : { auth: null };
}

// The real handler is wrapped by functions.https.onCall, which only exposes a `.run(data,
// context)` test helper in the emulator harness -- this codebase has no existing precedent for
// that (see onOirSubmissionCreated.js's own comment on testing the extracted handler directly
// instead). notifyGradingComplete.js doesn't export an unwrapped handler, so these tests invoke
// the callable's underlying handler via the same `.run()` the firebase-functions-test package
// exposes on a v1 onCall CloudFunction -- confirmed available on the exported CloudFunction object.
test('rejects an unauthenticated call', async () => {
  await assert.rejects(
    () => notifyGradingComplete.run({ submissionId: 'sub1' }, makeContext(undefined)),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('rejects a call with no submissionId', async () => {
  await assert.rejects(
    () => notifyGradingComplete.run({}, makeContext('user1')),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});
