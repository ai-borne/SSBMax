import { FC } from 'react';
import { Play, Lock, Clock, ShieldAlert } from 'lucide-react';
import { strings } from '../../constants/strings';
import { AccessTier, hasTierAccess } from '../../constants/ssbSelectionProcess';
import { TestSimulatorConfig } from './ssbTestConfigs';

export interface TestSimulatorCardProps {
  test: TestSimulatorConfig;
  userTier?: AccessTier;
  onLaunch: (testId: string) => void;
  onUnlockTier?: (tier: AccessTier) => void;
}

export const TestSimulatorCard: FC<TestSimulatorCardProps> = ({
  test,
  userTier = 'cadet',
  onLaunch,
  onUnlockTier,
}) => {
  const isUnlocked = hasTierAccess(userTier, test.requiredTier);

  const handleClick = () => {
    if (isUnlocked) {
      onLaunch(test.id);
    } else if (onUnlockTier) {
      onUnlockTier(test.requiredTier);
    }
  };

  const getTierBadgeStyle = () => {
    switch (test.requiredTier) {
      case 'command':
        return 'bg-violetSubtle text-violetToken border-violetToken/40 font-black';
      case 'officer':
        return 'bg-goldSubtle text-gold border-gold/40 font-black';
      case 'cadet':
      default:
        return 'bg-emeraldSubtle text-emeraldToken border-emeraldToken/40 font-black';
    }
  };

  const getTierBadgeLabel = () => {
    switch (test.requiredTier) {
      case 'command':
        return strings.subscription.commandBadge;
      case 'officer':
        return strings.subscription.officerBadge;
      case 'cadet':
      default:
        return strings.subscription.cadetBadge;
    }
  };

  return (
    <div
      data-testid={`test-simulator-card-${test.id}`}
      className="bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 hover:border-sky-500/50 dark:hover:border-sky-500/50 rounded-2xl p-5 shadow-[var(--card-shadow)] hover:-translate-y-1 hover:shadow-[var(--card-shadow-hover)] transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        {/* Header & Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50">
            {test.shortCode}
          </span>
          <div className="flex items-center gap-1.5">
            {test.isMostPopular && (
              <span
                data-testid={`most-popular-badge-${test.id}`}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-violetSubtle text-violetToken border-violetToken/40"
              >
                {strings.subscription.proPlanBadge}
              </span>
            )}
            <span
              data-testid="tier-badge"
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getTierBadgeStyle()}`}
            >
              {getTierBadgeLabel()}
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
          {test.title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          {test.description}
        </p>

        {/* OLQs Evaluated Chips */}
        {test.olqsEvaluated && test.olqsEvaluated.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {test.olqsEvaluated.slice(0, 3).map((olq, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/40"
              >
                {olq}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer & Action Button */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          {test.timeLimit}
        </span>

        <button
          onClick={handleClick}
          data-testid={`launch-button-${test.id}`}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm relative overflow-hidden ${
            isUnlocked
              ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 animate-shimmer'
              : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/40'
          }`}
        >
          {isUnlocked ? (
            <>
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span>{strings.gto.launchSimulator}</span>
            </>
          ) : test.requiredTier === 'command' ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{strings.gto.commandRequired}</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{strings.gto.proRequired}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TestSimulatorCard;
