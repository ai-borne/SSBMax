import { FC } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useTheme } from '../../hooks/useTheme';
import { ThemeMode } from '../../constants/colors';

export interface AppearanceSectionProps {
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

export const AppearanceSection: FC<AppearanceSectionProps> = ({ theme: customTheme, onToggleTheme }) => {
  const { theme: hookTheme, toggleTheme: hookToggleTheme } = useTheme();
  const currentTheme = customTheme ?? hookTheme;

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      hookToggleTheme();
    }
  };

  const getThemeLabel = () => {
    if (currentTheme === 'dark') return strings.settings.themeDark;
    if (currentTheme === 'light') return strings.settings.themeLight;
    return strings.settings.themeSystem;
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 space-y-4">
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
          className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 shadow-sm"
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
  );
};

export default AppearanceSection;
