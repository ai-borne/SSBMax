/**
 * Admin-only read of the Phase 8 signup counters (`analytics_daily/{yyyy-MM-dd}`, written by
 * `recordSignup.js`). Same admin-gating convention as `getSubscriptionSupportSnapshot.js`: the
 * `admin: true` custom claim on `context.auth.token`, checked here, never by hiding the web
 * route (see AnalyticsDashboardPage.tsx's doc comment).
 *
 * Returns every daily doc since the first one that exists -- there is no historical baseline to
 * bound the query against (Phase 0 finding: "day zero" is whenever this instrumentation ships,
 * not something recoverable from the past), so "since" here just means "since data exists".
 * Traffic and referrer totals are NOT duplicated here -- see `recordSignup.js`'s doc comment for
 * why that lives in the Cloudflare Web Analytics dashboard instead.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const runtimeOptions = { maxInstances: 10 };

async function getAnalyticsSummaryFromDb(firestoreDb) {
  const snap = await firestoreDb.collection(FirestorePaths.ANALYTICS_DAILY).orderBy(admin.firestore.FieldPath.documentId()).get();

  const days = snap.docs.map((docSnap) => ({
    date: docSnap.id,
    signups: typeof docSnap.data().signups === 'number' ? docSnap.data().signups : 0
  }));

  const totalSignups = days.reduce((sum, day) => sum + day.signups, 0);

  return {
    days,
    totalSignups,
    sinceDate: days.length > 0 ? days[0].date : null
  };
}

exports.getAnalyticsSummary = functions.runWith(runtimeOptions).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to use this tool');
  }
  if (context.auth.token?.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  try {
    return await getAnalyticsSummaryFromDb(db);
  } catch (error) {
    console.error('getAnalyticsSummary: Firestore read failed', {
      userId: context.auth.uid,
      function: 'getAnalyticsSummary',
      error: error instanceof Error ? error.message : String(error)
    });
    throw new functions.https.HttpsError('internal', 'Failed to load analytics summary');
  }
});

exports.getAnalyticsSummaryFromDb = getAnalyticsSummaryFromDb;
