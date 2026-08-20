/**
 * Support-view snapshot lookup (Phase 9, Payment Ecosystem Hardening plan).
 *
 * Answering "I paid and I'm still on Free" today means opening the Firestore console, the
 * Razorpay dashboard, and the RevenueCat dashboard and joining them by hand. This callable joins
 * them server-side for one user: the Firestore `data/subscription` doc, the matching Razorpay
 * subscription (if the stored doc names one), the RevenueCat subscriber state (re-using
 * `repairMobileEntitlement.js`'s `fetchRevenueCatSubscriberState` -- no second hand-typed RC
 * reducer, see L4), and the last N `ops_alerts` docs for that user.
 *
 * Admin-only, checked server-side via the `admin: true` custom claim on `context.auth.token`
 * (`functions/scripts/set-admin-claim.js` grants it) -- never by hiding a route in the SPA
 * (root CLAUDE.md, "surface conflicts, don't average" / this phase's own access-control note).
 * Read-only: there is no write path here at all, so this tool can never become a back door for
 * granting tiers -- that would be C1 (Phase 1) reintroduced through a different door.
 *
 * A Razorpay or RevenueCat outage must not fail the whole call -- a support tool that goes dark
 * exactly when billing is broken is worthless -- so each external source degrades independently
 * to `{ unavailable: true }` rather than throwing.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { getSubscription } = require('../lib/razorpayClient');
const { fetchRevenueCatSubscriberState } = require('./repairMobileEntitlement');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const runtimeOptions = {
  maxInstances: 10,
  secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'REVENUECAT_SECRET_KEY']
};

// How many recent alerts a support agent needs to spot a pattern (repeated drift, a rejected
// repair attempt) without the panel turning into an unreadable dump.
const RECENT_ALERTS_LIMIT = 20;

async function readFirestoreSubscription(firestoreDb, userId) {
  try {
    const snap = await firestoreDb
      .collection(FirestorePaths.USERS)
      .doc(userId)
      .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
      .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      .get();
    return snap.exists ? { exists: true, ...snap.data() } : { exists: false, tier: 'FREE' };
  } catch (error) {
    console.error('getSubscriptionSupportSnapshot: Firestore subscription read failed', error);
    return { unavailable: true };
  }
}

async function readRazorpaySubscription(fetchImpl, keyId, keySecret, subscriptionId) {
  if (!subscriptionId) return null;
  if (!keyId || !keySecret) return { unavailable: true, reason: 'missing-credentials' };
  try {
    return await getSubscription(fetchImpl, { keyId, keySecret, subscriptionId });
  } catch (error) {
    console.error('getSubscriptionSupportSnapshot: Razorpay lookup failed', error);
    return { unavailable: true };
  }
}

async function readRevenueCatSubscriber(fetchImpl, secretKey, userId) {
  if (!secretKey) return { unavailable: true, reason: 'missing-credentials' };
  try {
    return await fetchRevenueCatSubscriberState(fetchImpl, secretKey, userId);
  } catch (error) {
    console.error('getSubscriptionSupportSnapshot: RevenueCat lookup failed', error);
    return { unavailable: true };
  }
}

async function readRecentAlerts(firestoreDb, userId) {
  try {
    const snap = await firestoreDb
      .collection(FirestorePaths.OPS_ALERTS)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(RECENT_ALERTS_LIMIT)
      .get();
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error('getSubscriptionSupportSnapshot: ops_alerts read failed', error);
    return { unavailable: true };
  }
}

/**
 * The join itself, against an injectable `firestoreDb`/`fetchImpl` -- same testability
 * convention as every other callable in this plan (`repairMobileEntitlementForUser`,
 * `cancelRazorpaySubscriptionForUser`).
 */
async function getSubscriptionSupportSnapshotForUser(firestoreDb, fetchImpl, userId) {
  const firestoreState = await readFirestoreSubscription(firestoreDb, userId);
  const razorpaySubscriptionId =
    firestoreState.source === 'RAZORPAY' && typeof firestoreState.subscriptionId === 'string'
      ? firestoreState.subscriptionId
      : null;

  const [razorpayState, revenueCatState, alerts] = await Promise.all([
    readRazorpaySubscription(fetchImpl, process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET, razorpaySubscriptionId),
    readRevenueCatSubscriber(fetchImpl, process.env.REVENUECAT_SECRET_KEY, userId),
    readRecentAlerts(firestoreDb, userId)
  ]);

  return { userId, firestore: firestoreState, razorpay: razorpayState, revenueCat: revenueCatState, alerts };
}

exports.getSubscriptionSupportSnapshot = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to use the support tool');
  }
  if (context.auth.token?.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const userId = typeof data?.userId === 'string' ? data.userId.trim() : '';
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  return getSubscriptionSupportSnapshotForUser(db, fetch, userId);
});

exports.getSubscriptionSupportSnapshotForUser = getSubscriptionSupportSnapshotForUser;
