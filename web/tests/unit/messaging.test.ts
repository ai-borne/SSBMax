import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getToken, isSupported } from 'firebase/messaging';

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn(),
  isSupported: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  app: {}
}));

import { getDeviceId, requestPushPermission } from '../../src/config/messaging';

function mockRepository() {
  return { saveFCMToken: vi.fn().mockResolvedValue(undefined) } as any;
}

describe('getDeviceId', () => {
  beforeEach(() => localStorage.clear());

  it('persists a stable device id across calls, matching NotificationRepository\'s {userId}_{deviceId} doc-id scheme', () => {
    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
    expect(localStorage.getItem('ssbmax_web_device_id')).toBe(first);
  });
});

describe('requestPushPermission', () => {
  const originalNotification = (globalThis as any).Notification;
  const originalEnv = import.meta.env.VITE_FIREBASE_VAPID_KEY;

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isSupported).mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue({}) },
      configurable: true
    });
    import.meta.env.VITE_FIREBASE_VAPID_KEY = 'test-vapid-key';
  });

  afterEach(() => {
    (globalThis as any).Notification = originalNotification;
    import.meta.env.VITE_FIREBASE_VAPID_KEY = originalEnv;
  });

  it('returns unsupported when the browser has no Notification API, so callers can hide the toggle instead of throwing', async () => {
    delete (globalThis as any).Notification;
    const result = await requestPushPermission('user_1', mockRepository());
    expect(result.status).toBe('unsupported');
  });

  it('does not silently no-op when the VAPID key is unconfigured -- surfaces an explicit error per Rule 12', async () => {
    (globalThis as any).Notification = { requestPermission: vi.fn(), permission: 'default' };
    import.meta.env.VITE_FIREBASE_VAPID_KEY = '';
    const result = await requestPushPermission('user_1', mockRepository());
    expect(result.status).toBe('error');
  });

  it('registers the service worker, fetches a token, and saves it via NotificationRepository with platform "web" on grant', async () => {
    (globalThis as any).Notification = { requestPermission: vi.fn().mockResolvedValue('granted'), permission: 'default' };
    vi.mocked(getToken).mockResolvedValue('fcm-token-abc');
    const repository = mockRepository();

    const result = await requestPushPermission('user_1', repository);

    expect(result.status).toBe('granted');
    expect(repository.saveFCMToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', token: 'fcm-token-abc', platform: 'web' })
    );
  });

  it('reports denied without registering a token when the user declines the browser prompt', async () => {
    (globalThis as any).Notification = { requestPermission: vi.fn().mockResolvedValue('denied'), permission: 'default' };
    const repository = mockRepository();

    const result = await requestPushPermission('user_1', repository);

    expect(result.status).toBe('denied');
    expect(repository.saveFCMToken).not.toHaveBeenCalled();
  });
});
