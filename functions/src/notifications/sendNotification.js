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

// Per-testType result-screen route template, keyed the same as TEST_TYPE_LABELS.
// GTO_PGT/GOR/HGT/IO(individual obstacles)/CT have no ported result screen yet
// (StudyContentGraph.kt's TopicScreen.onNavigateToTest routes them to the
// NotYetPorted placeholder too), so they're intentionally absent here and fall
// back to Routes.NOTIFICATIONS_CENTER below.
const TEST_TYPE_RESULT_ROUTE_TEMPLATES = {
  OIR: Routes.TEST_OIR_RESULT,
  PPDT: Routes.TEST_PPDT_RESULT,
  TAT: Routes.TEST_TAT_RESULT,
  WAT: Routes.TEST_WAT_RESULT,
  SRT: Routes.TEST_SRT_RESULT,
  SD: Routes.TEST_SD_RESULT,
  PIQ: Routes.TEST_PIQ_RESULT,
  GTO_GD: Routes.TEST_GTO_GD_RESULT,
  GTO_LECTURETTE: Routes.TEST_GTO_LECTURETTE_RESULT,
  GTO_GPE: Routes.TEST_GTO_GPE_RESULT,
  IO: Routes.INTERVIEW_RESULT
};

/** Builds the notification's actionUrl from testType + submissionId, falling back
 * to the notification center itself when no result route is registered yet. */
function buildResultActionUrl(testType, submissionId) {
  const template = TEST_TYPE_RESULT_ROUTE_TEMPLATES[testType];
  if (!template) return Routes.NOTIFICATIONS_CENTER;
  return template.replace('{submissionId}', submissionId).replace('{resultId}', submissionId);
}

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
  const title = 'Your result is ready';
  const message = `Your ${label} evaluation has been graded.`;
  const actionUrl = buildResultActionUrl(testType, submissionId);

  return writeAndPush({
    firestoreDb,
    userId,
    type: 'GRADING_COMPLETE',
    title,
    message,
    actionUrl,
    actionData: { submissionId, testType },
    messaging
  });
}

/**
 * Writes one `NOTIFICATIONS` doc, then best-effort pushes it via FCM. Shared by every
 * notification source (`notifyEvaluationComplete` above, `scheduledDailyPracticeReminders.js`)
 * so the write-then-best-effort-push shape lives once. `type` flows through to both the
 * Firestore doc and the FCM payload's `data.type` -- previously `sendPush` hardcoded
 * `GRADING_COMPLETE` there regardless of the actual notification type.
 *
 * @param actionData plain-string-valued object; stringified into the FCM data payload as-is
 */
async function writeAndPush({ firestoreDb, userId, type, title, message, actionUrl, actionData, messaging }) {
  const notificationRef = firestoreDb.collection(FirestorePaths.NOTIFICATIONS).doc();

  await notificationRef.set({
    id: notificationRef.id,
    userId,
    type,
    priority: 'NORMAL',
    title,
    message,
    actionUrl,
    actionData,
    isRead: false,
    createdAt: Date.now(),
    expiresAt: null
  });

  try {
    await sendPush({
      firestoreDb,
      userId,
      type,
      title,
      body: message,
      actionUrl,
      actionData,
      notificationId: notificationRef.id,
      messaging: messaging || require('firebase-admin').messaging()
    });
  } catch (error) {
    // The NOTIFICATIONS doc above already landed -- the in-app inbox is the
    // source of truth, push is best-effort on top of it. Never let a push
    // failure (bad token, messaging quota, no default app in a test/local
    // context) fail the caller.
    console.error('writeAndPush: push send failed', { userId, type, error: error.message });
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
async function sendPush({ firestoreDb, userId, type, title, body, actionUrl, actionData, notificationId, messaging }) {
  const tokensSnapshot = await firestoreDb
    .collection(FirestorePaths.FCM_TOKENS)
    .where('userId', '==', userId)
    .get();

  if (tokensSnapshot.empty) {
    return;
  }

  const tokenDocs = tokensSnapshot.docs;
  const tokens = tokenDocs.map((doc) => doc.data().token);

  const stringifiedActionData = Object.fromEntries(
    Object.entries(actionData || {}).map(([key, value]) => [key, String(value)])
  );

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      actionUrl,
      ...stringifiedActionData,
      notificationId,
      type
    }
  });

  const staleTokenDeletes = response.responses
    .map((result, index) => ({ result, doc: tokenDocs[index] }))
    .filter(({ result }) => !result.success && result.error && result.error.code === STALE_TOKEN_ERROR_CODE)
    .map(({ doc }) => doc.ref.delete());

  await Promise.all(staleTokenDeletes);
}

module.exports = { notifyEvaluationComplete, writeAndPush, TEST_TYPE_LABELS };
