/**
 * Soft-delete step 1 of 3 (docs/plans/AccountDeletion.md): marks `users/{uid}.deletionRequestedAt`
 * and disables the Auth account. Touches no data collections -- the grace period lets
 * `cancelAccountDeletion` undo this cleanly until `purgeExpiredAccounts` runs the real cascade.
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function requestAccountDeletionCore(db, authAdmin, uid) {
  await db
    .collection(FirestorePaths.USERS)
    .doc(uid)
    .set({ deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await authAdmin.updateUser(uid, { disabled: true });
  return { success: true };
}

exports.requestAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  return requestAccountDeletionCore(db, admin.auth(), context.auth.uid);
});

exports.requestAccountDeletionCore = requestAccountDeletionCore;
