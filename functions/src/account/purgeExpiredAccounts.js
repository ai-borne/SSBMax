/**
 * Soft-delete step 3 of 3 (docs/plans/AccountDeletion.md): daily sweep that hard-deletes any
 * account whose grace period (`GRACE_PERIOD_DAYS`) has elapsed since `requestAccountDeletion`.
 * Firestore cascade runs first; `admin.auth().deleteUser` runs LAST, only after the cascade
 * succeeds, so a partial cascade failure can never strand an already-deleted Auth account with
 * orphaned data unreachable by any future retry (the user doc, and thus the query below, would
 * already be gone).
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { cascadeDeleteUserData } = require('./cascadeDelete');

if (!admin.apps.length) {
  admin.initializeApp();
}

const GRACE_PERIOD_DAYS = 7;

async function purgeExpiredAccountsCore(db, authAdmin, cutoff) {
  const snapshot = await db.collection(FirestorePaths.USERS).where('deletionRequestedAt', '<=', cutoff).get();

  let purgedCount = 0;
  for (const doc of snapshot.docs) {
    const uid = doc.id;
    try {
      await cascadeDeleteUserData(db, uid);
      await authAdmin.deleteUser(uid);
      purgedCount++;
    } catch (e) {
      console.error(`[purgeExpiredAccounts] failed to purge ${uid}: ${e.message}`);
    }
  }
  return { purgedCount };
}

exports.purgeExpiredAccounts = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const { purgedCount } = await purgeExpiredAccountsCore(db, admin.auth(), cutoff);
  console.log(`[purgeExpiredAccounts] purged ${purgedCount} accounts past the ${GRACE_PERIOD_DAYS}-day grace period`);
  return null;
});

exports.purgeExpiredAccountsCore = purgeExpiredAccountsCore;
exports.GRACE_PERIOD_DAYS = GRACE_PERIOD_DAYS;
