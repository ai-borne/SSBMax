/**
 * Soft-delete step 2 of 3 (docs/plans/AccountDeletion.md): undoes `requestAccountDeletion`
 * within the grace window -- clears `deletionRequestedAt` and re-enables the Auth account.
 * Rejects `failed-precondition` if there's no pending request (already cancelled, never
 * requested, or already purged by `purgeExpiredAccounts`).
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function cancelAccountDeletionCore(db, authAdmin, uid) {
  const userRef = db.collection(FirestorePaths.USERS).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists || snap.data().deletionRequestedAt == null) {
    throw new functions.https.HttpsError('failed-precondition', 'No pending deletion request for this account');
  }
  await userRef.update({ deletionRequestedAt: admin.firestore.FieldValue.delete() });
  await authAdmin.updateUser(uid, { disabled: false });
  return { success: true };
}

exports.cancelAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  return cancelAccountDeletionCore(db, admin.auth(), context.auth.uid);
});

exports.cancelAccountDeletionCore = cancelAccountDeletionCore;
