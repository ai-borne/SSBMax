/**
 * Signup counter (Phase 8, ai_search_readiness plan -- "Measurement & Instrumentation").
 *
 * Phase 0's findings doc (docs/plans/ai_search_readiness_phase0_findings.md, §7) found web had
 * zero instrumentation: no analytics, no GSC verification, and critically no existing
 * signup-rate metric to diff against. Un-gating the Study tab (Phase 4) removed the one signal
 * that made a signup mean anything -- so this callable exists to start counting from here.
 *
 * Deliberately narrow: this is a counter, not an event log. `analytics_daily/{yyyy-MM-dd}`
 * holds one `signups` field incremented per call -- no userId, no IP, no timestamp per event.
 * Traffic/referrer segmentation (chatgpt.com/perplexity.ai/claude.ai) is handled separately by
 * Cloudflare Web Analytics (see index.html/prerenderHtml.mjs's beacon) rather than duplicated
 * here -- Cloudflare's dashboard already gives cookie-less referrer breakdown, and building a
 * second pipeline for that would be pure duplication for the pages that matter most (the
 * genuinely-static GEO landing pages ship no app JS to call a second callable from anyway).
 *
 * Auth required (`context.auth`) -- this only fires from `AuthService.signInWithGoogle()` right
 * after a real Firebase Auth sign-in resolves, so an unauthenticated caller has nothing
 * legitimate to report. This also keeps it from being an open write for anyone to inflate the
 * counter anonymously.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const runtimeOptions = { maxInstances: 10 };

/** yyyy-MM-dd in UTC -- a fixed calendar-day bucket, not tied to any user's local timezone. */
function todayDocId(nowMillis = Date.now()) {
  return new Date(nowMillis).toISOString().slice(0, 10);
}

async function recordSignupForToday(firestoreDb, nowMillis = Date.now()) {
  const docId = todayDocId(nowMillis);
  await firestoreDb
    .collection(FirestorePaths.ANALYTICS_DAILY)
    .doc(docId)
    .set({ signups: admin.firestore.FieldValue.increment(1) }, { merge: true });
  return { date: docId };
}

exports.recordSignup = functions.runWith(runtimeOptions).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to record a signup');
  }

  try {
    return await recordSignupForToday(db);
  } catch (error) {
    console.error('recordSignup: Firestore write failed', {
      userId: context.auth.uid,
      function: 'recordSignup',
      error: error instanceof Error ? error.message : String(error)
    });
    throw new functions.https.HttpsError('internal', 'Failed to record signup');
  }
});

exports.recordSignupForToday = recordSignupForToday;
exports.todayDocId = todayDocId;
