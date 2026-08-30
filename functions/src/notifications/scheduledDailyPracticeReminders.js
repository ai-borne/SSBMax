/**
 * Daily 09:00 cron that sends a `TEST_REMINDER` notification + push to every user with
 * `notificationPreferences.enableTestReminders == true` (pattern-matched to
 * `scheduledSubscriptionReconciliation.js`). `enableTestReminders`/`NotificationType.TEST_REMINDER`
 * already exist on both KMP platforms (repository, ViewModel, UI switch) -- this cron is the
 * missing piece that actually writes the doc + push they've always been able to receive.
 *
 * Capped with a single `.limit()`, not `scheduledSubscriptionReconciliation.js`'s full
 * page-cursor pagination -- at this feature's current user scale a single page comfortably
 * covers every opted-in user; revisit with real pagination once `notificationPreferences` scale
 * approaches `MAX_PRACTICE_REMINDER_RECIPIENTS`.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths, Routes } = require('../generated/contracts.cjs');
const { writeAndPush } = require('./sendNotification');

if (!admin.apps.length) {
  admin.initializeApp();
}

const MAX_PRACTICE_REMINDER_RECIPIENTS = 1000;

/**
 * @param db injected Firestore (real `admin.firestore()` or a test fake)
 * @param messaging injected `admin.messaging()` (real or a test fake)
 */
async function sendDailyPracticeReminders(db, messaging) {
  const snapshot = await db
    .collection(FirestorePaths.NOTIFICATION_PREFERENCES)
    .where('enableTestReminders', '==', true)
    .limit(MAX_PRACTICE_REMINDER_RECIPIENTS)
    .get();

  let sentCount = 0;
  for (const doc of snapshot.docs) {
    const { userId } = doc.data();
    if (!userId) continue;

    await writeAndPush({
      firestoreDb: db,
      userId,
      type: 'TEST_REMINDER',
      title: 'Time for today\'s SSB practice',
      message: 'Keep your prep streak going -- attempt a test or study topic today.',
      actionUrl: Routes.NOTIFICATIONS_CENTER,
      actionData: {},
      messaging
    });
    sentCount += 1;
  }

  return { sentCount };
}

exports.scheduledDailyPracticeReminders = functions.pubsub.schedule('every day 09:00').onRun(async () => {
  const db = admin.firestore();
  const { sentCount } = await sendDailyPracticeReminders(db, admin.messaging());
  console.log(`[scheduledDailyPracticeReminders] sent ${sentCount} daily practice reminder(s)`);
  return null;
});

exports.sendDailyPracticeReminders = sendDailyPracticeReminders;
exports.MAX_PRACTICE_REMINDER_RECIPIENTS = MAX_PRACTICE_REMINDER_RECIPIENTS;
