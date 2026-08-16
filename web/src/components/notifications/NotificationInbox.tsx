import { FC } from 'react';
import { CheckCheck, Bell } from 'lucide-react';
import { strings } from '../../constants/strings';
import type { SSBMaxNotification } from '../../types/notification';

export interface NotificationInboxProps {
  notifications: SSBMaxNotification[];
  isLoading: boolean;
  error: string | null;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
}

function formatRelativeTime(createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(createdAt).toLocaleDateString();
}

/**
 * Dropdown inbox body rendered by `NotificationBell`. Mark-read semantics mirror
 * KMP's `NotificationCenterViewModel` (Tier 3, hand-kept in sync): clicking an unread
 * notification marks only that one read; "Mark all read" batches every unread doc.
 */
export const NotificationInbox: FC<NotificationInboxProps> = ({ notifications, isLoading, error, onMarkAsRead, onMarkAllAsRead }) => {
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="w-80 max-h-96 flex flex-col rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80 shadow-xl dark:shadow-slate-950/60 overflow-hidden" data-testid="notification-inbox">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{strings.notifications.inboxTitle}</h3>
        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            data-testid="mark-all-read-button"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {strings.notifications.markAllRead}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <div className="p-4 space-y-3" data-testid="notification-inbox-skeleton">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="p-4 text-xs text-red-600 dark:text-red-400" data-testid="notification-inbox-error">
            {strings.notifications.errorLoading}
          </p>
        ) : notifications.length === 0 ? (
          <div className="p-6 flex flex-col items-center text-center gap-2" data-testid="notification-inbox-empty">
            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{strings.notifications.emptyTitle}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{strings.notifications.emptyBody}</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
              className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors ${
                notification.isRead ? 'bg-transparent' : 'bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-950/50'
              }`}
              data-testid={`notification-item-${notification.id}`}
            >
              <div className="flex items-center gap-2">
                {!notification.isRead && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" data-testid={`notification-unread-dot-${notification.id}`} />}
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{notification.title}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{notification.message}</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(notification.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationInbox;
