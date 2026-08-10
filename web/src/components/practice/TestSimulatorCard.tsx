import { FC } from 'react';
import { Play, Lock, Clock, ShieldAlert } from 'lucide-react';
import { strings } from '../../constants/strings';
import { AccessTier, hasTierAccess } from '../../constants/ssbSelectionProcess';
import { TestSimulatorConfig } from './ssbTestConfigs';
import { GridCardContainer } from '../common/GridCardContainer';

export interface TestSimulatorCardProps {
  test: TestSimulatorConfig;
  userTier?: AccessTier;
  /**
   * Remaining monthly attempts from `checkTestEligibility` (undefined when the caller hasn't
   * computed real usage — falls back to the tier-only gate, which is exactly what the eligibility
   * engine would also return at zero usage). `0` locks the card even when `userTier` clears the
   * bucket's minimum tier — the "remaining quota, not a binary gate" requirement from
   * docs/plans/CrossPlatform_SSOT Phase 4.
   */
  remainingTests?: number;
  onLaunch: (testId: string) => void;
  onUnlockTier?: (tier: AccessTier) => void;
}

export const TestSimulatorCard: FC<TestSimulatorCardProps> = ({
  test,
  userTier = 'FREE',
  remainingTests,
  onLaunch,
  onUnlockTier,
}) => {
  const isUnlocked = hasTierAccess(userTier, test.requiredTier) && remainingTests !== 0;
  const showRemainingBadge = isUnlocked && typeof remainingTests === 'number' && remainingTests < 99;

  const handleClick = () => {
    if (isUnlocked) {
      onLaunch(test.id);
    } else if (onUnlockTier) {
      onUnlockTier(test.requiredTier);
    }
  };

  const getTierBadgeStyle = () => {
    switch (test.requiredTier) {
      case 'PREMIUM':
        return 'bg-violetSubtle text-violetToken border-violetToken/40 font-black';
      case 'PRO':
        return 'bg-goldSubtle text-gold border-gold/40 font-black';
      case 'FREE':
      default:
        return 'bg-emeraldSubtle text-emeraldToken border-emeraldToken/40 font-black';
    }
  };

  const getTierBadgeLabel = () => {
    switch (test.requiredTier) {
      case 'PREMIUM':
        return strings.subscription.tierBadgePremium;
      case 'PRO':
        return strings.subscription.tierBadgePro;
      case 'FREE':
      default:
        return strings.subscription.tierBadgeFree;
    }
  };

  const variant = test.requiredTier === 'PREMIUM' ? 'premium' : test.requiredTier === 'PRO' ? 'pro' : 'free';

  return (
    <GridCardContainer
      variant={variant}
      dense
      testId={`test-simulator-card-${test.id}`}
      className="p-5 hover:-translate-y-1 transition-all duration-200 h-full"
    >
      <div>
        {/* Header & Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50">
            {test.shortCode}
          </span>
          <span
            data-testid="tier-badge"
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getTierBadgeStyle()}`}
          >
            {getTierBadgeLabel()}
          </span>
        </div>

        {/* Title & Description */}
        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
          {test.title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          {test.description}
        </p>
      </div>

      {/* Footer & Action Button */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {test.timeLimit}
          </span>
          {showRemainingBadge && (
            <span data-testid="remaining-quota-badge" className="text-emerald-600 dark:text-emerald-400 font-bold">
              {remainingTests} left
            </span>
          )}
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
          ) : remainingTests === 0 && hasTierAccess(userTier, test.requiredTier) ? (
            <>
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{strings.gto.limitReached}</span>
            </>
          ) : test.requiredTier === 'PREMIUM' ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{strings.gto.premiumRequired}</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{strings.gto.proRequired}</span>
            </>
          )}
        </button>
      </div>
    </GridCardContainer>
  );
};

export default TestSimulatorCard;
