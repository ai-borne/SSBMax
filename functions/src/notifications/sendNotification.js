/**
 * Phase 1 (Centralized Result-Announcement Notifications plan): writes the
 * `NOTIFICATIONS` doc every evaluation-completion site calls once it flips a
 * submission to `COMPLETED`. Field shape mirrors
 * `shared/.../domain/model/Notification.kt`'s `SSBMaxNotification` exactly, so
 * every client (Android/iOS/web) reads one consistent doc regardless of which
 * evaluator wrote it.
 *
 * Phase 2: also pushes via `admin.messaging().sendEachForMulticast()` against
 * every `FCM_TOKENS` row for the user -- one call path for Android/iOS/web,
 * since iOS now registers a real FCM token (see
 * `IosPushNotificationBridge.kt`), not a raw APNs device token. A push-send
 * failure never fails the doc write above -- the in-app inbox is the source
 * of truth; push is best-effort delivery on top of it.
 */

const { FirestorePaths, Routes } = require('../generated/contracts.cjs');

const STALE_TOKEN_ERROR_CODE = 'messaging/registration-token-not-registered';

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
 * @param messaging injected `admin.messaging()` (real or a test fake); defaults to the
 *   real Admin SDK singleton so existing call sites (Phase 1) don't need to change
 */
async function notifyEvaluationComplete({ firestoreDb, userId, testType, submissionId, messaging }) {
  const label = TEST_TYPE_LABELS[testType] || testType;
  const notificationRef = firestoreDb.collection(FirestorePaths.NOTIFICATIONS).doc();
  const title = 'Your result is ready';
  const message = `Your ${label} evaluation has been graded.`;

  await notificationRef.set({
    id: notificationRef.id,
    userId,
    type: 'GRADING_COMPLETE',
    priority: 'NORMAL',
    title,
    message,
    actionUrl: Routes.NOTIFICATIONS_CENTER,
    actionData: { submissionId, testType },
    isRead: false,
    createdAt: Date.now(),
    expiresAt: null
  });

  try {
    await sendPush({
      firestoreDb,
      userId,
      title,
      body: message,
      actionUrl: Routes.NOTIFICATIONS_CENTER,
      actionData: { submissionId, testType },
      messaging: messaging || require('firebase-admin').messaging()
    });
  } catch (error) {
    // The NOTIFICATIONS doc above already landed -- the in-app inbox is the
    // source of truth, push is best-effort on top of it. Never let a push
    // failure (bad token, messaging quota, no default app in a test/local
    // context) fail the evaluation completion itself.
    console.error('notifyEvaluationComplete: push send failed', { userId, testType, submissionId, error: error.message });
  }

  return { id: notificationRef.id };
}

/**
 * Reads every `FCM_TOKENS` row for `userId` (one doc per device/platform --
 * `${userId}_${deviceId}`, per `GitLiveNotificationRepository.saveFCMToken`)
 * and multicasts one push across all of them. Deletes any row FCM reports as
 * unregistered so a stale token doesn't get retried on every future
 * notification.
 */
async function sendPush({ firestoreDb, userId, title, body, actionUrl, actionData, messaging }) {
  const tokensSnapshot = await firestoreDb
    .collection(FirestorePaths.FCM_TOKENS)
    .where('userId', '==', userId)
    .get();

  if (tokensSnapshot.empty) {
    return;
  }

  const tokenDocs = tokensSnapshot.docs;
  const tokens = tokenDocs.map((doc) => doc.data().token);

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      actionUrl,
      submissionId: String(actionData.submissionId),
      testType: String(actionData.testType)
    }
  });

  const staleTokenDeletes = response.responses
    .map((result, index) => ({ result, doc: tokenDocs[index] }))
    .filter(({ result }) => !result.success && result.error && result.error.code === STALE_TOKEN_ERROR_CODE)
    .map(({ doc }) => doc.ref.delete());

  await Promise.all(staleTokenDeletes);
}

module.exports = { notifyEvaluationComplete };
