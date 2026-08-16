import { useEffect, useState } from 'react';
import { NotificationRepository } from '../repositories/NotificationRepository';
import type { SSBMaxNotification } from '../types/notification';

export interface NotificationCenterState {
  isLoading: boolean;
  notifications: SSBMaxNotification[];
  unreadCount: number;
  error: string | null;
}

export interface NotificationCenterActions {
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Web port of KMP's `NotificationCenterViewModel` (Tier 3, no mechanical enforcement --
 * hand-kept in sync, see `shared/.../presentation/notifications/NotificationCenterViewModel.kt`).
 * Unlike the KMP original, this drops date-grouping and the ALL/UNREAD/GRADING/FEEDBACK/
 * ANNOUNCEMENTS filter -- the web bell/inbox (Phase 6) only needs a flat recent list, and
 * adding an unused filter UI here would be speculative scope per root CLAUDE.md Rule 2.
 * `subscribeToNotifications`/`subscribeToUnreadCount` are live Firestore listeners (Phase 5),
 * so state here updates in real time without polling.
 */
export function useNotificationCenterViewModel(
  userId: string | undefined,
  injectedRepository?: NotificationRepository
): NotificationCenterState & NotificationCenterActions {
  const [defaultRepository] = useState(() => new NotificationRepository());
  const repository = injectedRepository ?? defaultRepository;

  const [state, setState] = useState<NotificationCenterState>({
    isLoading: true,
    notifications: [],
    unreadCount: 0,
    error: null
  });

  useEffect(() => {
    if (!userId) {
      setState({ isLoading: false, notifications: [], unreadCount: 0, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const unsubscribeNotifications = repository.subscribeToNotifications(userId, (notifications) => {
      setState((prev) => ({ ...prev, isLoading: false, notifications, error: null }));
    });
    const unsubscribeUnreadCount = repository.subscribeToUnreadCount(userId, (unreadCount) => {
      setState((prev) => ({ ...prev, unreadCount }));
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  }, [userId, repository]);

  const markAsRead = async (notificationId: string) => {
    try {
      await repository.markAsRead(notificationId);
    } catch (e) {
      setState((prev) => ({ ...prev, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await repository.markAllAsRead(userId);
    } catch (e) {
      setState((prev) => ({ ...prev, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  return { ...state, markAsRead, markAllAsRead };
}
