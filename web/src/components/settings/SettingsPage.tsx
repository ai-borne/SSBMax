import { FC, useState } from 'react';
import { Settings, Sun, Moon, Monitor, Bell, Database, HardDrive, CheckCircle2, ShieldCheck, Wifi } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useTheme } from '../../hooks/useTheme';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ThemeMode } from '../../constants/colors';

export interface SettingsPageProps {
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onClearCache?: () => void;
}

export const SettingsPage: FC<SettingsPageProps> = ({
  theme: customTheme,
  onToggleTheme,
  onClearCache
}) => {
  const { theme: hookTheme, toggleTheme: hookToggleTheme } = useTheme();
  const currentTheme = customTheme ?? hookTheme;
  const isOnline = useOnlineStatus();

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [offlineSyncAlerts, setOfflineSyncAlerts] = useState(true);
  const [practiceReminders, setPracticeReminders] = useState(false);
  const [cacheClearedStatus, setCacheClearedStatus] = useState(false);

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      hookToggleTheme();
    }
  };

  const handleClearCache = () => {
    if (onClearCache) {
      onClearCache();
    } else {
      localStorage.clear();
    }
    setCacheClearedStatus(true);
    setTimeout(() => setCacheClearedStatus(false), 3000);
  };

  const getThemeLabel = () => {
    if (currentTheme === 'dark') return strings.settings.themeDark;
    if (currentTheme === 'light') return strings.settings.themeLight;
    return strings.settings.themeSystem;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8" data-testid="settings-page">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
          <Settings className="w-4 h-4" />
          <span>{strings.settings.title}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {strings.settings.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto">
          {strings.settings.subtitle}
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Appearance Theme */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {currentTheme === 'dark' ? (
                  <Moon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                ) : currentTheme === 'light' ? (
                  <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Monitor className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{strings.settings.appearanceTitle}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{strings.settings.appearanceSub}</p>
            </div>
            <button
              onClick={handleToggleTheme}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 shadow-sm"
              data-testid="toggle-theme-setting"
            >
              {currentTheme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{strings.settings.themeLight}</span>
                </>
              ) : currentTheme === 'light' ? (
                <>
                  <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{strings.settings.themeSystem}</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{strings.settings.themeDark}</span>
                </>
              )}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{strings.settings.themeLabel}:</span>
            <span className="font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider" data-testid="current-theme-label">
              {getThemeLabel()}
            </span>
          </div>
        </div>

        {/* Section 2: Notifications */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4">
          <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>{strings.settings.notificationsTitle}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{strings.settings.notificationsSub}</p>
          </div>

          <div className="space-y-3">
            {/* Toggle 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.emailAlerts}</span>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
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

            {/* Toggle 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.offlineSyncAlerts}</span>
              <button
                onClick={() => setOfflineSyncAlerts(!offlineSyncAlerts)}
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

            {/* Toggle 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strings.settings.practiceReminders}</span>
              <button
                onClick={() => setPracticeReminders(!practiceReminders)}
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

        {/* Section 3: Data & Offline Cache Controls */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{strings.settings.dataStorageTitle}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{strings.settings.dataStorageSub}</p>
            </div>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-2"
              data-testid="clear-cache-button"
            >
              <HardDrive className="w-4 h-4" />
              <span>{strings.settings.clearCache}</span>
            </button>
          </div>
          {cacheClearedStatus && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2" data-testid="cache-cleared-banner">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{strings.settings.cacheCleared}</span>
            </div>
          )}
        </div>

        {/* Section 4: System Diagnostics */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>{strings.settings.systemTitle}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 block">{strings.settings.appVersion}</span>
              <span className="font-bold text-slate-900 dark:text-white mt-1 block" data-testid="app-version-value">v1.0.0-PRO</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 block">{strings.settings.pwaStatus}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block" data-testid="pwa-status-value">Active (Workbox SW)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 block">{strings.settings.onlineStatus}</span>
              <span className={`font-bold mt-1 flex items-center gap-1.5 ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} data-testid="network-status-value">
                <Wifi className="w-3.5 h-3.5" />
                <span>{isOnline ? strings.header.statusOnline : strings.header.statusOffline}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
