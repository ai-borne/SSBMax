import { FC, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useNotificationCenterViewModel } from '../../viewmodels/useNotificationCenterViewModel';
import { NotificationInbox } from './NotificationInbox';
import type { SSBMaxNotification } from '../../types/notification';

export interface NotificationBellProps {
  userId: string | undefined;
  onNotificationClick?: (notification: SSBMaxNotification) => void;
}

/**
 * Header bell + dropdown inbox (Phase 6, Centralized Result-Announcement Notifications
 * plan). Behaviorally aligned by hand with KMP's `NotificationCenterViewModel`/its
 * Compose bell (Tier 3, no mechanical enforcement -- note this file as the parity
 * counterpart for future changes to the KMP ViewModel).
 */
export const NotificationBell: FC<NotificationBellProps> = ({ userId, onNotificationClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead } = useNotificationCenterViewModel(userId);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!userId) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        aria-label={strings.notifications.bellLabel}
        title={strings.notifications.bellLabel}
        data-testid="notification-bell-button"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
            data-testid="notification-unread-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50">
          <NotificationInbox
            notifications={notifications}
            isLoading={isLoading}
            error={error}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNotificationClick={(notification) => {
              setIsOpen(false);
              onNotificationClick?.(notification);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
