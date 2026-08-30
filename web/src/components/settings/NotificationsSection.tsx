import { FC } from 'react';
import { Bell } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useNotificationPreferencesViewModel } from '../../viewmodels/useNotificationPreferencesViewModel';
import { NotificationPermissionPrompt } from '../notifications/NotificationPermissionPrompt';
import { requestPushPermission } from '../../config/messaging';

export interface NotificationsSectionProps {
  userId?: string;
}

/**
 * Notification settings. Both toggles are backed by the real
 * `notificationPreferences` Firestore doc (via
 * `useNotificationPreferencesViewModel`). "Push Notifications" drives the
 * browser permission request + FCM token registration
 * (`requestPushPermission`). "Daily SSB Practice Reminders" persists
 * `enableTestReminders`, which is already fully wired on KMP. The
 * previously-stubbed "Email AI Report Dossiers" and "Offline Queue Sync
 * Alerts" toggles were removed (no persistence, no backend consumer).
 */
export const NotificationsSection: FC<NotificationsSectionProps> = ({ userId }) => {
  const { preferences, setEnablePushNotifications, setEnableTestReminders } = useNotificationPreferencesViewModel(userId);
  const pushEnabled = preferences?.enablePushNotifications ?? false;
  const practiceRemindersEnabled = preferences?.enableTestReminders ?? false;

  const togglePush = async () => {
    if (!userId) return;
    if (!pushEnabled) {
      const result = await requestPushPermission(userId);
      if (result.status !== 'granted') return;
    }
    await setEnablePushNotifications(!pushEnabled);
  };

  const togglePracticeReminders = async () => {
    if (!userId) return;
    await setEnableTestReminders(!practiceRemindersEnabled);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 space-y-4">
      <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>{strings.settings.notificationsTitle}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{strings.settings.notificationsSub}</p>
      </div>

      {userId && <NotificationPermissionPrompt userId={userId} />}

      <div className="space-y-3">
        {userId && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.notifications.bellLabel}</span>
            <button
              onClick={togglePush}
              aria-label={strings.notifications.bellLabel}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                pushEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-800'
              }`}
              data-testid="toggle-push-notifications"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  pushEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {userId && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.practiceReminders}</span>
            <button
              onClick={togglePracticeReminders}
              aria-label={strings.settings.practiceReminders}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                practiceRemindersEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-800'
              }`}
              data-testid="toggle-practice-reminders"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  practiceRemindersEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsSection;
