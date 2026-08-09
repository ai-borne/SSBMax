import { FC } from 'react';
import { Check, ShieldCheck, Zap, Crown, Award } from 'lucide-react';
import { strings } from '../../constants/strings';
import { SUBSCRIPTION_TIERS, AccessTier } from '../../constants/ssbSelectionProcess';

export interface PaymentRibbonProps {
  currentTier?: AccessTier;
  onSelectTier?: (tier: AccessTier) => void;
  onUpgradeClick?: (tier: AccessTier) => void;
}

export const PaymentRibbon: FC<PaymentRibbonProps> = ({
  currentTier = 'cadet',
  onSelectTier,
  onUpgradeClick,
}) => {
  const handleCardClick = (tierId: AccessTier) => {
    if (onSelectTier) {
      onSelectTier(tierId);
    }
    if (tierId !== currentTier && onUpgradeClick) {
      onUpgradeClick(tierId);
    }
  };

  return (
    <div className="w-full space-y-4" data-testid="payment-ribbon">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Award className="w-5 h-5 shrink-0" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {strings.subscription.ribbonTitle}
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {strings.subscription.ribbonSubtitle}
        </p>
      </div>

      {/* Responsive 3-Tier Grid / Mobile Snap-Scroll */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible no-scrollbar">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isActive = currentTier === tier.id;
          const isOfficer = tier.id === 'officer';
          const isCommand = tier.id === 'command';

          return (
            <div
              key={tier.id}
              data-testid={`tier-card-${tier.id}`}
              className={`snap-center shrink-0 w-[280px] sm:w-[300px] md:w-auto p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                isCommand
                  ? 'bg-gradient-to-b from-amber-500/10 via-slate-900/90 to-slate-900 border-2 border-amber-500/50 dark:border-amber-400/60 shadow-lg shadow-amber-500/10'
                  : isOfficer
                  ? 'bg-gradient-to-b from-sky-500/10 via-slate-900/90 to-slate-900 border-2 border-sky-500 dark:border-sky-400 shadow-xl shadow-sky-500/10'
                  : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm'
              }`}
            >
              <div>
                {/* Header & Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isCommand
                        ? 'bg-amber-500 text-slate-950'
                        : isOfficer
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tier.badge}
                  </span>
                  {isCommand ? (
                    <Crown className="w-4 h-4 text-amber-400" />
                  ) : isOfficer ? (
                    <Zap className="w-4 h-4 text-sky-400" />
                  ) : null}
                </div>

                {/* Title & Pricing */}
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {tier.title}
                </h4>
                <div className="flex items-baseline gap-1 mt-1 mb-4">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {tier.price}
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-2 mb-6 pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleCardClick(tier.id)}
                data-testid={`upgrade-button-${tier.id}`}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-emerald-600 text-white cursor-default shadow-md shadow-emerald-600/20'
                    : isCommand
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : isOfficer
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-md shadow-sky-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isActive ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{strings.subscription.currentPlan}</span>
                  </>
                ) : (
                  <span>{tier.buttonText}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentRibbon;
