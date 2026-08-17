import { FC, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { strings } from '../../constants/strings';
import { requestPushPermission } from '../../config/messaging';

const DISMISSED_STORAGE_KEY = 'ssbmax_push_prompt_dismissed';

export interface NotificationPermissionPromptProps {
  userId: string;
}

/**
 * Dismissible banner gating web push behind explicit user permission (Phase 7,
 * Centralized Result-Announcement Notifications plan). Only renders when the
 * browser's Notification permission is still 'default' (never asked, never
 * denied) and the user hasn't dismissed it before -- dismissal persists in
 * localStorage so it doesn't re-prompt every visit.
 */
export const NotificationPermissionPrompt: FC<NotificationPermissionPromptProps> = ({ userId }) => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true');
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldRender =
    !dismissed &&
    status !== 'granted' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default';

  if (!shouldRender) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    setDismissed(true);
  };

  const enable = async () => {
    setStatus('requesting');
    setErrorMessage(null);
    const result = await requestPushPermission(userId);
    if (result.status === 'granted') {
      setStatus('granted');
    } else if (result.status === 'denied') {
      setStatus('denied');
    } else {
      setStatus('error');
      setErrorMessage('message' in result ? result.message : strings.notifications.permissionUnsupported);
    }
  };

  return (
    <div
      className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 flex items-start gap-3"
      data-testid="notification-permission-prompt"
    >
      <Bell className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{strings.notifications.permissionPromptTitle}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{strings.notifications.permissionPromptBody}</p>
        {status === 'denied' && (
          <p className="text-xs text-red-600 dark:text-red-400">{strings.notifications.permissionDenied}</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage ?? strings.notifications.permissionError}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={enable}
            disabled={status === 'requesting'}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
            data-testid="notification-permission-enable"
          >
            {strings.notifications.permissionEnable}
          </button>
          <button
            onClick={dismiss}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            data-testid="notification-permission-dismiss"
          >
            {strings.notifications.permissionDismiss}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label={strings.notifications.permissionDismiss}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        data-testid="notification-permission-close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default NotificationPermissionPrompt;
