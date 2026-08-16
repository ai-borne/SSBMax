import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import {
  defaultNotificationPreferences,
  type FCMToken,
  type NotificationPreferences,
  type SSBMaxNotification
} from '../types/notification';

const FIELD_USER_ID = 'userId';
const FIELD_IS_READ = 'isRead';

/**
 * Web port of KMP's `GitLiveNotificationRepository` (Phase 5, Centralized
 * Result-Announcement Notifications plan) -- same three Firestore collections
 * (`notifications`, `fcmTokens`, `notificationPreferences`), same field names,
 * same `firestore.rules` scoping (owner-only read/update/delete, no client
 * create). Web has no local SQLDelight/Room cache, so unlike the KMP repo,
 * `subscribeToNotifications`/`subscribeToUnreadCount` here read Firestore
 * directly via `onSnapshot` -- the first live-listener usage in
 * `web/src/repositories/` (existing pattern elsewhere is one-shot + polling).
 * That's a deliberate, justified deviation: an inbox/bell needs live updates,
 * and there's no cache layer to poll instead.
 *
 * Every subscribe method returns an `Unsubscribe` -- callers MUST invoke it
 * (e.g. on component unmount) to avoid leaking a live Firestore listener.
 */
export class NotificationRepository {
  subscribeToNotifications(userId: string, onChange: (notifications: SSBMaxNotification[]) => void): Unsubscribe {
    const q = query(collection(db, FirestorePaths.NOTIFICATIONS), where(FIELD_USER_ID, '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs
          .map((d) => d.data() as SSBMaxNotification)
          .sort((a, b) => b.createdAt - a.createdAt);
        onChange(notifications);
      },
      (error) => console.warn(`Notification subscription failed for user ${userId}`, error)
    );
  }

  subscribeToUnreadCount(userId: string, onChange: (count: number) => void): Unsubscribe {
    const q = query(
      collection(db, FirestorePaths.NOTIFICATIONS),
      where(FIELD_USER_ID, '==', userId),
      where(FIELD_IS_READ, '==', false)
    );
    return onSnapshot(
      q,
      (snapshot) => onChange(snapshot.size),
      (error) => console.warn(`Unread-count subscription failed for user ${userId}`, error)
    );
  }

  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, FirestorePaths.NOTIFICATIONS, notificationId), { [FIELD_IS_READ]: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, FirestorePaths.NOTIFICATIONS),
      where(FIELD_USER_ID, '==', userId),
      where(FIELD_IS_READ, '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.update(d.ref, { [FIELD_IS_READ]: true }));
    await batch.commit();
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const snap = await getDoc(doc(db, FirestorePaths.NOTIFICATION_PREFERENCES, userId));
    return snap.exists() ? (snap.data() as NotificationPreferences) : defaultNotificationPreferences(userId);
  }

  async savePreferences(preferences: NotificationPreferences): Promise<void> {
    await setDoc(doc(db, FirestorePaths.NOTIFICATION_PREFERENCES, preferences.userId), preferences);
  }

  /** Doc id matches KMP's `GitLiveNotificationRepository` (`{userId}_{deviceId}`). */
  async saveFCMToken(token: FCMToken): Promise<void> {
    await setDoc(doc(db, FirestorePaths.FCM_TOKENS, `${token.userId}_${token.deviceId}`), token);
  }
}
