import { FC, useState, useEffect } from 'react';
import { User, LogOut, Edit3, Award, Target } from 'lucide-react';
import { strings } from '../../constants/strings';
import { authService, UserProfile } from '../../services/AuthService';

export interface AccountPageProps {
  user?: UserProfile | null;
  onSignOut?: () => void;
  onEditDiagnostic?: () => void;
  onUpgradeClick?: () => void;
}

export const AccountPage: FC<AccountPageProps> = ({
  user: initialUser,
  onSignOut,
  onEditDiagnostic,
  onUpgradeClick
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(initialUser ?? null);

  useEffect(() => {
    if (initialUser !== undefined) {
      setCurrentUser(initialUser);
      return;
    }
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    const unsubscribe = authService.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, [initialUser]);

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await authService.signOut();
    }
  };

  const isPro = currentUser?.isPaidMember ?? false;
  const initials = currentUser?.displayName
    ? currentUser.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CD';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8" data-testid="account-page">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
          <User className="w-4 h-4" />
          <span>{strings.account.title}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {strings.account.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto">
          {strings.account.subtitle}
        </p>
      </div>

      {/* User Profile Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-sky-600/20"
              data-testid="user-initials"
            >
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white" data-testid="user-name">
                {currentUser?.displayName || 'Officer Candidate'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="user-email">
                {currentUser?.email || 'cadet@ssbmax.in'}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-2"
            data-testid="sign-out-button"
          >
            <LogOut className="w-4 h-4" />
            <span>{strings.account.signOut}</span>
          </button>
        </div>

        {/* Subscription & Membership Status */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isPro ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">{strings.account.membershipTier}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider" data-testid="membership-badge">
                {isPro ? strings.subscription.proPlanTitle : strings.subscription.freePlanTitle}
              </span>
            </div>
          </div>

          {!isPro && onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-md"
              data-testid="upgrade-pass-button"
            >
              Upgrade to PRO
            </button>
          )}
        </div>

        {/* Target Profile Diagnostic Summary */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Target Selection Board Target</span>
            </h3>
            {onEditDiagnostic && (
              <button
                onClick={onEditDiagnostic}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                data-testid="edit-diagnostic-button"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 block">Target Armed Force</span>
              <span className="font-bold text-slate-900 dark:text-slate-200 mt-0.5 block">Indian Army (SSB Board)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-500 block">Entry Stream</span>
              <span className="font-bold text-slate-900 dark:text-slate-200 mt-0.5 block">CDS (Combined Defence Services)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
