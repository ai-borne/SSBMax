import { getToken, getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { app } from './firebase';
import { NotificationRepository } from '../repositories/NotificationRepository';

const DEVICE_ID_STORAGE_KEY = 'ssbmax_web_device_id';
const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

export type PushPermissionResult =
  | { status: 'granted' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

/**
 * Stable per-browser device id, matching the `{userId}_{deviceId}` FCM_TOKENS
 * doc-id scheme `NotificationRepository.saveFCMToken` already uses (Phase 5).
 * Web has no platform-provided device identifier (unlike Android/iOS), so this
 * is generated once and persisted in localStorage.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

async function resolveMessaging(): Promise<Messaging | null> {
  if (!(await isSupported())) return null;
  return getMessaging(app);
}

/**
 * Requests browser push permission, registers `firebase-messaging-sw.js`, and
 * persists the resulting FCM token via `NotificationRepository.saveFCMToken`
 * (Phase 5) with `platform: 'web'` -- the third leg of the single multicast
 * `sendEachForMulticast` path from Phase 2 (Android/iOS already write theirs).
 *
 * `VITE_FIREBASE_VAPID_KEY` is a Firebase Console web-push credential (see
 * plan's "Open items requiring user input" #1) -- until it's configured this
 * returns `{ status: 'error' }` rather than silently no-op-ing, per Rule 12.
 */
export async function requestPushPermission(
  userId: string,
  repository: NotificationRepository = new NotificationRepository()
): Promise<PushPermissionResult> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return { status: 'unsupported' };
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey) {
    return { status: 'error', message: 'Web push is not configured (missing VAPID key).' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: permission === 'denied' ? 'denied' : 'error', message: 'Notification permission was not granted.' };
  }

  const messaging = await resolveMessaging();
  if (!messaging) return { status: 'unsupported' };

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { status: 'error', message: 'Could not obtain a push token.' };

    const now = Date.now();
    await repository.saveFCMToken({
      userId,
      token,
      deviceId: getDeviceId(),
      platform: 'web',
      createdAt: now,
      updatedAt: now
    });
    return { status: 'granted' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
