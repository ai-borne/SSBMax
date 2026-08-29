import { FC } from 'react';
import { Settings, ShieldCheck, Wifi, FileText, Lock } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ThemeMode } from '../../constants/colors';
import { AccountSection } from './AccountSection';
import { AppearanceSection } from './AppearanceSection';
import { NotificationsSection } from './NotificationsSection';
import { DataCacheSection } from './DataCacheSection';
import { FAQSection } from './FAQSection';
import { DeveloperSettingsCard } from './DeveloperSettingsCard';
import { DevTierOverride } from '../../constants/ssbSelectionProcess';
import { Gender, EntryType } from '../../types/userProfile';

import { GridCardContainer } from '../common/GridCardContainer';

export interface SettingsPageProps {
  userId?: string;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onClearCache?: () => void;
  onEditDiagnostic?: () => void;
  onUpgrade?: () => void;
  onSignOut?: () => void;
  onViewPrivacy?: () => void;
  onViewTerms?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isGuest?: boolean;
  isPro?: boolean;
  age?: number;
  gender?: Gender;
  entryType?: EntryType;
  hasProfile?: boolean;
  isProfileLoading?: boolean;
  devTierOverride?: DevTierOverride;
  onSelectDevTier?: (override: DevTierOverride) => void;
}

export const SettingsPage: FC<SettingsPageProps> = ({
  userId,
  theme: customTheme,
  onToggleTheme,
  onClearCache,
  onEditDiagnostic,
  onUpgrade,
  onSignOut,
  onViewPrivacy,
  onViewTerms,
  userEmail,
  userName,
  isGuest = true,
  isPro = false,
  age,
  gender,
  entryType,
  hasProfile = false,
  isProfileLoading = false,
  devTierOverride = 'FOLLOW_REAL',
  onSelectDevTier,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <div className="max-w-4xl w-full mx-auto px-4 py-6 space-y-8" data-testid="settings-page">
      {/* Hero Header Banner Card - Clean Card Elevation */}
      <GridCardContainer variant="free" testId="settings-header-banner" className="p-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
          <Settings className="w-4 h-4" />
          <span>{strings.settings.title}</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {strings.settings.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-2xl">
          {strings.settings.subtitle}
        </p>
      </GridCardContainer>

      <div className="space-y-6">
        {/* Section 1: Candidate Account Credentials & Profile */}
        <AccountSection
          userEmail={userEmail}
          userName={userName}
          isGuest={isGuest}
          isPro={isPro}
          age={age}
          gender={gender}
          entryType={entryType}
          hasProfile={hasProfile}
          isProfileLoading={isProfileLoading}
          onEditDiagnostic={onEditDiagnostic}
          onUpgrade={onUpgrade}
          onSignOut={onSignOut}
        />

        {/* Section 2: Appearance & Display Theme */}
        <AppearanceSection theme={customTheme} onToggleTheme={onToggleTheme} />

        {/* Section 3: Notifications & Intelligence Sync */}
        <NotificationsSection userId={userId} />

        {/* Section 4: Data & Offline Cache Controls */}
        <DataCacheSection onClearCache={onClearCache} />

        {/* Section 5: FAQs Accordion */}
        <FAQSection />

        {/* Section 6: Legal Policies & Compliance */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 space-y-4" data-testid="legal-section">
          <div className="space-y-1 pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{strings.legalSection.title}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{strings.legalSection.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onViewPrivacy && (
              <button
                onClick={onViewPrivacy}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2"
                data-testid="view-privacy-btn"
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>{strings.legalSection.viewPrivacy}</span>
              </button>
            )}
            {onViewTerms && (
              <button
                onClick={onViewTerms}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2"
                data-testid="view-terms-btn"
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>{strings.legalSection.viewTerms}</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 7: System Diagnostics */}
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

        {/* Section 8: Developer Settings (dev builds only) */}
        {import.meta.env.DEV && (
          <DeveloperSettingsCard
            devTierOverride={devTierOverride}
            onSelectOverride={(override) => onSelectDevTier?.(override)}
          />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
