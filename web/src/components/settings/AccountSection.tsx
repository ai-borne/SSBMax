import { FC } from 'react';
import { User, ShieldAlert, Sparkles, LogOut, Edit3, Award, Target } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface AccountSectionProps {
  userEmail?: string | null;
  userName?: string | null;
  isGuest?: boolean;
  isPro?: boolean;
  targetBoard?: string;
  entryStream?: string;
  prepStatus?: string;
  onEditDiagnostic?: () => void;
  onUpgrade?: () => void;
  onSignOut?: () => void;
}

export const AccountSection: FC<AccountSectionProps> = ({
  userEmail = 'cadet@ssbmax.in',
  userName = 'Officer Cadet Candidate',
  isGuest = true,
  isPro = false,
  targetBoard = 'Indian Army (SSB)',
  entryStream = 'CDS Entry',
  prepStatus = 'Intermediate Prep',
  onEditDiagnostic,
  onUpgrade,
  onSignOut,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-5" data-testid="account-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>{strings.account.candidateDetails}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{strings.account.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPro ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5" data-testid="pro-pass-badge">
              <Award className="w-3.5 h-3.5" />
              <span>{strings.subscription.proPlanTitle}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-600 dark:text-slate-400 text-xs font-bold" data-testid="free-pass-badge">
              {strings.subscription.freePlanTitle}
            </span>
          )}
        </div>
      </div>

      {/* Explicit No PII Privacy Warning Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5" data-testid="pii-privacy-warning">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{strings.account.piqPrivacyWarning}</p>
      </div>

      {/* Candidate Profile Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block font-medium">{strings.account.displayName}</span>
          <span className="font-bold text-slate-900 dark:text-white block text-sm" data-testid="account-display-name">
            {userName || 'Officer Cadet Candidate'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block font-medium">{strings.account.email}</span>
          <span className="font-bold text-slate-900 dark:text-white block text-sm truncate" data-testid="account-email">
            {userEmail || 'cadet@ssbmax.in'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block font-medium flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-sky-500" />
            <span>{strings.account.targetBoard}</span>
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block" data-testid="account-target-board">
            {targetBoard} ({entryStream})
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 block font-medium">{strings.account.prepStatus}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block" data-testid="account-prep-status">
            {prepStatus}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {onEditDiagnostic && (
          <button
            onClick={onEditDiagnostic}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2"
            data-testid="edit-diagnostic-btn"
          >
            <Edit3 className="w-4 h-4 text-sky-500" />
            <span>{strings.account.editDiagnostic}</span>
          </button>
        )}

        {!isPro && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            data-testid="upgrade-pass-btn"
          >
            <Sparkles className="w-4 h-4" />
            <span>{strings.subscription.upgradeNow}</span>
          </button>
        )}

        {!isGuest && onSignOut && (
          <button
            onClick={onSignOut}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs border border-rose-500/30 transition-all flex items-center gap-2 ml-auto"
            data-testid="sign-out-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>{strings.account.signOut}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountSection;
