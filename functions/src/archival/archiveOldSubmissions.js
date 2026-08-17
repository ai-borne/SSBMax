/**
 * `archiveOldSubmissions` scheduled Cloud Function -- submission archival server-migration.
 *
 * `archived_submissions` is server-only in `firestore.rules` (`allow write: if false`), but
 * `GitLiveSubmissionArchiveRepository.archiveOldSubmissions()` used to write to it directly from
 * Android's daily `ArchivalWorker` -- always PERMISSION_DENIED, so nothing was ever archived
 * (and per the same `runCatching` block covering both the copy and the delete, a failed copy also
 * means the original was never deleted -- no data loss, just no archival). iOS's BGTaskScheduler
 * equivalent has no execution guarantee at all per `BackgroundTaskScheduler`'s own doc comment, so
 * this was never reliable there either. A `pubsub.schedule` Cloud Function fixes both platforms at
 * once with the Admin SDK (which bypasses the deny-all rule) and removes the need for any
 * per-device job.
 *
 * Not scoped to a test type -- sweeps the `submissions` collection group uniformly (WAT/SRT/SD/
 * TAT/PPDT/GTO/Interview/OIR/PIQ all live under the same `submissions` shape), same as the
 * Kotlin original.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const ARCHIVE_AFTER_DAYS = 180;
const CONCURRENCY = 20;

/**
 * Copies each submission doc older than `cutoffTimestamp` into `archived_submissions/{id}`, then
 * deletes the original -- but only if the copy succeeded. A per-doc failure (e.g. a transient
 * write error) is isolated: that doc is left alone in `submissions` for the next run to retry,
 * matching the Kotlin original's per-item `runCatching` isolation.
 */
async function archiveOldSubmissionsCore(db, cutoffTimestamp) {
  const snapshot = await db.collectionGroup(FirestorePaths.SUBMISSIONS_ARCHIVE_GROUP).where('submittedAt', '<', cutoffTimestamp).get();

  let archivedCount = 0;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const chunk = docs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (doc) => {
        try {
          const raw = doc.data();
          const submissionId = typeof raw.id === 'string' && raw.id !== '' ? raw.id : doc.id;
          await db.collection(FirestorePaths.ARCHIVED_SUBMISSIONS).doc(submissionId).set(raw);
          await doc.ref.delete();
          return true;
        } catch (e) {
          console.error(`[archiveOldSubmissions] failed to archive ${doc.id}: ${e.message}`);
          return false;
        }
      })
    );
    archivedCount += results.filter(Boolean).length;
  }

  return { archivedCount };
}

exports.archiveOldSubmissions = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const cutoffTimestamp = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const { archivedCount } = await archiveOldSubmissionsCore(admin.firestore(), cutoffTimestamp);
  console.log(`[archiveOldSubmissions] archived ${archivedCount} submissions older than ${ARCHIVE_AFTER_DAYS} days`);
  return null;
});

exports.archiveOldSubmissionsCore = archiveOldSubmissionsCore;
exports.ARCHIVE_AFTER_DAYS = ARCHIVE_AFTER_DAYS;
