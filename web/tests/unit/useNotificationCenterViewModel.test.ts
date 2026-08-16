import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotificationCenterViewModel } from '../../src/viewmodels/useNotificationCenterViewModel';
import type { SSBMaxNotification } from '../../src/types/notification';

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

function mockRepository(overrides: Partial<Record<string, any>> = {}) {
  return {
    subscribeToNotifications: vi.fn(() => vi.fn()),
    subscribeToUnreadCount: vi.fn(() => vi.fn()),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as any;
}

describe('useNotificationCenterViewModel', () => {
  it('subscribes to notifications and unread count when a user is present, and unsubscribes on unmount', () => {
    const unsubscribeNotifications = vi.fn();
    const unsubscribeUnreadCount = vi.fn();
    const repository = mockRepository({
      subscribeToNotifications: vi.fn(() => unsubscribeNotifications),
      subscribeToUnreadCount: vi.fn(() => unsubscribeUnreadCount)
    });

    const { unmount } = renderHook(() => useNotificationCenterViewModel('user_1', repository));

    expect(repository.subscribeToNotifications).toHaveBeenCalledWith('user_1', expect.any(Function));
    expect(repository.subscribeToUnreadCount).toHaveBeenCalledWith('user_1', expect.any(Function));

    // Every subscribe method must be unwound on unmount -- otherwise the bell keeps a live
    // Firestore listener open after the component using it is gone (leak, per Phase 5's hard
    // contract on NotificationRepository's subscribe methods).
    unmount();
    expect(unsubscribeNotifications).toHaveBeenCalledTimes(1);
    expect(unsubscribeUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('reflects live emissions from the repository into state', async () => {
    let emitNotifications: (n: SSBMaxNotification[]) => void = () => {};
    let emitUnreadCount: (c: number) => void = () => {};
    const repository = mockRepository({
      subscribeToNotifications: vi.fn((_userId: string, onChange: (n: SSBMaxNotification[]) => void) => {
        emitNotifications = onChange;
        return vi.fn();
      }),
      subscribeToUnreadCount: vi.fn((_userId: string, onChange: (c: number) => void) => {
        emitUnreadCount = onChange;
        return vi.fn();
      })
    });

    const { result } = renderHook(() => useNotificationCenterViewModel('user_1', repository));

    act(() => {
      emitNotifications([notification()]);
      emitUnreadCount(1);
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not subscribe when there is no signed-in user, and reports an empty, non-loading state', () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationCenterViewModel(undefined, repository));

    expect(repository.subscribeToNotifications).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications).toEqual([]);
  });

  it('markAsRead delegates to the repository', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationCenterViewModel('user_1', repository));

    await act(() => result.current.markAsRead('n1'));
    expect(repository.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('markAllAsRead delegates to the repository with the current userId', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationCenterViewModel('user_1', repository));

    await act(() => result.current.markAllAsRead());
    expect(repository.markAllAsRead).toHaveBeenCalledWith('user_1');
  });

  it('surfaces an error message when markAsRead fails', async () => {
    const repository = mockRepository({ markAsRead: vi.fn().mockRejectedValue(new Error('boom')) });
    const { result } = renderHook(() => useNotificationCenterViewModel('user_1', repository));

    await act(() => result.current.markAsRead('n1'));
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });
});
