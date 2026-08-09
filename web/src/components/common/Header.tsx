import { useState, useEffect, FC } from 'react';
import { Sun, Moon, Monitor, Wifi, WifiOff, Download, ShieldCheck } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useTheme } from '../../hooks/useTheme';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const Header: FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const getThemeTitle = () => {
    if (theme === 'dark') return `${strings.header.toggleThemeLight} (Current: Dark)`;
    if (theme === 'light') return `${strings.header.toggleThemeSystem} (Current: Light)`;
    return `${strings.header.toggleThemeDark} (Current: System OS)`;
  };

  return (
    <header className="w-full bg-slate-900 dark:bg-slate-900 border-b border-slate-700 text-slate-50 px-4 py-3 shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-600 text-white flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">{strings.header.title}</h1>
          <p className="text-xs text-slate-400">{strings.header.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Online / Offline Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isOnline
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50'
              : 'bg-amber-950/40 text-amber-400 border-amber-700/50'
          }`}
          data-testid="online-status-badge"
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>{strings.header.statusOnline}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>{strings.header.statusOffline}</span>
            </>
          )}
        </div>

        {/* PWA Install Trigger */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
            title={strings.header.installPwa}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{strings.header.installPwa}</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={getThemeTitle()}
          aria-label={getThemeTitle()}
          data-testid="theme-toggle-button"
        >
          {theme === 'dark' ? (
            <Moon className="w-5 h-5 text-sky-400" />
          ) : theme === 'light' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Monitor className="w-5 h-5 text-emerald-400" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
