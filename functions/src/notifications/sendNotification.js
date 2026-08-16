/**
 * Phase 1 (Centralized Result-Announcement Notifications plan): writes the
 * `NOTIFICATIONS` doc every evaluation-completion site calls once it flips a
 * submission to `COMPLETED`. Field shape mirrors
 * `shared/.../domain/model/Notification.kt`'s `SSBMaxNotification` exactly, so
 * every client (Android/iOS/web) reads one consistent doc regardless of which
 * evaluator wrote it.
 *
 * Doc-write only in this phase -- no push send yet (Phase 2 adds
 * `admin.messaging().sendEachForMulticast()` on top of this write).
 */

const { FirestorePaths, Routes } = require('../generated/contracts.cjs');

const TEST_TYPE_LABELS = {
  OIR: 'OIR',
  PPDT: 'PPDT',
  PIQ: 'PIQ',
  TAT: 'TAT',
  WAT: 'WAT',
  SRT: 'SRT',
  SD: 'Self Description',
  GTO_GD: 'Group Discussion',
  GTO_GPE: 'GPE',
  GTO_PGT: 'Progressive Group Task',
  GTO_GOR: 'Group Obstacle Race',
  GTO_HGT: 'Half Group Task',
  GTO_LECTURETTE: 'Lecturette',
  GTO_IO: 'Individual Obstacles',
  GTO_CT: 'Command Task',
  IO: 'Interview'
};

/**
 * @param firestoreDb injected Firestore (real `admin.firestore()` or a test fake)
 * @param userId owner of the completed submission
 * @param testType contract `TestType` id (e.g. `WAT`, `GTO_GD`)
 * @param submissionId the completed `submissions/{id}` doc's id
 */
async function notifyEvaluationComplete({ firestoreDb, userId, testType, submissionId }) {
  const label = TEST_TYPE_LABELS[testType] || testType;
  const notificationRef = firestoreDb.collection(FirestorePaths.NOTIFICATIONS).doc();

  await notificationRef.set({
    id: notificationRef.id,
    userId,
    type: 'GRADING_COMPLETE',
    priority: 'NORMAL',
    title: 'Your result is ready',
    message: `Your ${label} evaluation has been graded.`,
    actionUrl: Routes.NOTIFICATIONS_CENTER,
    actionData: { submissionId, testType },
    isRead: false,
    createdAt: Date.now(),
    expiresAt: null
  });

  return { id: notificationRef.id };
}

module.exports = { notifyEvaluationComplete };
