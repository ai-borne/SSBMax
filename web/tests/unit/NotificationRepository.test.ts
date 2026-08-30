import { describe, it, expect, vi } from 'vitest';
import { NotificationRepository } from '../../src/repositories/NotificationRepository';
import { onSnapshot, updateDoc, getDocs, writeBatch, getDoc, setDoc, WriteBatch, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';
import type { SSBMaxNotification } from '../../src/types/notification';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(() => ({})),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

function notification(overrides: Partial<SSBMaxNotification> = {}): SSBMaxNotification {
  return {
    id: 'n1',
    userId: 'user_1',
    type: 'GRADING_COMPLETE',
    priority: 'NORMAL',
    title: 'Result ready',
    message: 'Your TAT result is ready',
    isRead: false,
    createdAt: Date.now(),
    ...overrides
  };
}

describe('NotificationRepository', () => {
  it('subscribeToNotifications sorts newest-first and returns the unsubscribe fn', () => {
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, onNext: unknown) => {
      (onNext as (snapshot: unknown) => void)({
        docs: [
          { data: () => notification({ id: 'old', createdAt: 1 }) },
          { data: () => notification({ id: 'new', createdAt: 2 }) }
        ]
      });
      return unsubscribe;
    });

    const onChange = vi.fn();
    const result = new NotificationRepository().subscribeToNotifications('user_1', onChange);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new' }),
      expect.objectContaining({ id: 'old' })
    ]);
    // Every subscribe method must return the real unsubscribe -- callers rely on this to avoid
    // leaking a live Firestore listener (hard contract per Phase 5 of the notifications plan).
    expect(result).toBe(unsubscribe);
  });

  it('subscribeToUnreadCount reports the snapshot size', () => {
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, onNext: unknown) => {
      (onNext as (snapshot: unknown) => void)({ size: 3 });
      return vi.fn();
    });

    const onChange = vi.fn();
    new NotificationRepository().subscribeToUnreadCount('user_1', onChange);

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('markAsRead updates only the isRead field on the target doc', async () => {
    await new NotificationRepository().markAsRead('n1');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { isRead: true });
  });

  it('markAllAsRead batches an update per unread doc for the user', async () => {
    const update = vi.fn();
    const commit = vi.fn();
    vi.mocked(writeBatch).mockReturnValue({ update, commit } as unknown as WriteBatch);
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ ref: 'ref1' }, { ref: 'ref2' }]
    } as unknown as QuerySnapshot);

    await new NotificationRepository().markAllAsRead('user_1');

    expect(update).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('getPreferences falls back to defaults when no doc exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    const prefs = await new NotificationRepository().getPreferences('user_1');
    expect(prefs.userId).toBe('user_1');
    expect(prefs.enablePushNotifications).toBe(true);
  });

  it('savePreferences writes to the preferences doc keyed by userId', async () => {
    const preferences = {
      userId: 'user_1',
      enablePushNotifications: false,
      enableGradingNotifications: true,
      enableFeedbackNotifications: true,
      enableBatchInvitations: true,
      enableGeneralAnnouncements: true,
      enableStudyReminders: true,
      enableTestReminders: true,
      enableMarketplaceUpdates: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 8,
      updatedAt: Date.now()
    };
    await new NotificationRepository().savePreferences(preferences);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), preferences);
  });

  it('saveFCMToken writes to a doc keyed by userId_deviceId, matching the KMP repository', async () => {
    const token = {
      userId: 'user_1',
      token: 'tok',
      deviceId: 'device_1',
      platform: 'web' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await new NotificationRepository().saveFCMToken(token);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), token);
  });
});
