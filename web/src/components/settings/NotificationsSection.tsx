import { FC, useState } from 'react';
import { Bell } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useNotificationPreferencesViewModel } from '../../viewmodels/useNotificationPreferencesViewModel';
import { NotificationPermissionPrompt } from '../notifications/NotificationPermissionPrompt';
import { requestPushPermission } from '../../config/messaging';

export interface NotificationsSectionProps {
  userId?: string;
}

/**
 * Notification settings (Phase 7, Centralized Result-Announcement
 * Notifications plan). The "Push Notifications" toggle is now backed by the
 * real `notificationPreferences` Firestore doc (via
 * `useNotificationPreferencesViewModel`, Phase 5's `NotificationRepository`)
 * and drives the browser permission request + FCM token registration
 * (`requestPushPermission`, Phase 7). The other three toggles (email alerts,
 * offline-sync alerts, practice reminders) are unrelated settings outside
 * this plan's `notificationPreferences` schema -- left as local-state stubs,
 * not touched here.
 */
export const NotificationsSection: FC<NotificationsSectionProps> = ({ userId }) => {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [offlineSyncAlerts, setOfflineSyncAlerts] = useState(true);
  const [practiceReminders, setPracticeReminders] = useState(false);

  const { preferences, setEnablePushNotifications } = useNotificationPreferencesViewModel(userId);
  const pushEnabled = preferences?.enablePushNotifications ?? false;

  const togglePush = async () => {
    if (!userId) return;
    if (!pushEnabled) {
      const result = await requestPushPermission(userId);
      if (result.status !== 'granted') return;
    }
    await setEnablePushNotifications(!pushEnabled);
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

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.emailAlerts}</span>
          <button
            onClick={() => setEmailAlerts(!emailAlerts)}
            aria-label={strings.settings.emailAlerts}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              emailAlerts ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-800'
            }`}
            data-testid="toggle-email-alerts"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                emailAlerts ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.offlineSyncAlerts}</span>
          <button
            onClick={() => setOfflineSyncAlerts(!offlineSyncAlerts)}
            aria-label={strings.settings.offlineSyncAlerts}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              offlineSyncAlerts ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-800'
            }`}
            data-testid="toggle-sync-alerts"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                offlineSyncAlerts ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.practiceReminders}</span>
          <button
            onClick={() => setPracticeReminders(!practiceReminders)}
            aria-label={strings.settings.practiceReminders}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              practiceReminders ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-800'
            }`}
            data-testid="toggle-practice-reminders"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                practiceReminders ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsSection;
