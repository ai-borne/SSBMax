/**
 * Server-authoritative cascade delete for permanent account purge (Phase 1,
 * docs/plans/AccountDeletion.md -- the sole cascade-delete authority per root CLAUDE.md's
 * four-consumer SSOT section). Every collection an account can leave data in gets deleted
 * here, and nowhere else -- clients never run this logic themselves.
 *
 * `payments`, `webhook_logs`, `ops_alerts` are deliberately excluded (product decision):
 * the financial/audit trail survives account deletion.
 */
const { FirestorePaths } = require('../generated/contracts.cjs');

const BATCH_SIZE = 450;

/** Deletes every doc matched by `query`, `BATCH_SIZE` at a time, until none remain. */
async function deleteQueryBatch(db, query) {
  let deleted = 0;
  for (;;) {
    const snapshot = await query.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
    if (snapshot.docs.length < BATCH_SIZE) break;
  }
  return deleted;
}

/**
 * Collections that carry a top-level `userId` field and are queried/deleted via
 * `.where('userId', '==', uid)` (confirmed per-collection in Phase 0/1 research --
 * see docs/plans/AccountDeletion.md's cascade table).
 */
const USER_ID_SCOPED_COLLECTIONS = [
  FirestorePaths.SUBMISSIONS,
  FirestorePaths.ARCHIVED_SUBMISSIONS,
  FirestorePaths.INTERVIEW_SESSIONS,
  FirestorePaths.INTERVIEW_RESPONSES,
  FirestorePaths.INTERVIEW_RESULTS,
  FirestorePaths.INTERVIEW_QUESTIONS,
  FirestorePaths.GTO_RESULTS,
  FirestorePaths.PPDT_RESULTS,
  FirestorePaths.PSYCH_RESULTS,
  FirestorePaths.NOTIFICATIONS,
  FirestorePaths.FCM_TOKENS,
  FirestorePaths.QUESTION_USAGE,
  FirestorePaths.STUDY_PROGRESS,
  FirestorePaths.STUDY_SESSIONS,
  FirestorePaths.USER_PROGRESS,
  FirestorePaths.TEST_SESSIONS
];

/** Collections that must never be touched by this cascade, per the user's retention decision. */
const RETAINED_COLLECTIONS = ['payments', 'webhook_logs', 'ops_alerts'];

/**
 * Deletes every piece of a user's data. Returns a per-collection count so callers/tests can
 * assert exactly what was (and wasn't) touched. `users/{uid}` itself -- plus its `data/profile`
 * and `subscription/*` subcollections -- is recursively deleted last via `db.recursiveDelete`.
 */
async function cascadeDeleteUserData(db, uid) {
  const deletedByCollection = {};

  for (const collectionName of USER_ID_SCOPED_COLLECTIONS) {
    const query = db.collection(collectionName).where('userId', '==', uid);
    deletedByCollection[collectionName] = await deleteQueryBatch(db, query);
  }

  // `notificationPreferences` is keyed by uid directly (doc(NOTIFICATION_PREFERENCES, uid)),
  // not a queryable `userId` field -- confirmed via web/src/repositories/NotificationRepository.ts.
  const prefsRef = db.collection(FirestorePaths.NOTIFICATION_PREFERENCES).doc(uid);
  const prefsSnap = await prefsRef.get();
  if (prefsSnap.exists) {
    await prefsRef.delete();
    deletedByCollection[FirestorePaths.NOTIFICATION_PREFERENCES] = 1;
  } else {
    deletedByCollection[FirestorePaths.NOTIFICATION_PREFERENCES] = 0;
  }

  const userRef = db.collection(FirestorePaths.USERS).doc(uid);
  await db.recursiveDelete(userRef);
  deletedByCollection[FirestorePaths.USERS] = 1;

  return deletedByCollection;
}

module.exports = {
  cascadeDeleteUserData,
  deleteQueryBatch,
  USER_ID_SCOPED_COLLECTIONS,
  RETAINED_COLLECTIONS,
  BATCH_SIZE
};
