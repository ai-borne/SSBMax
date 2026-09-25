import { FC } from 'react';
import { Check, ShieldCheck, Award, Info, Smartphone } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useSubscriptionOwnership } from '../../viewmodels/useSubscriptionOwnership';
import { SUBSCRIPTION_TIERS, AccessTier } from '../../constants/ssbSelectionProcess';
import { tierPlanTitle } from '../../constants/tierLabels';

export interface SubscriptionPageProps {
  userId?: string;
  /** Real Firestore-backed tier, computed once in `App.tsx` (`isPaidMember = realTier !== 'FREE'`),
   * so "Membership Active" shows correctly on a hard reload. */
  isPaidMember?: boolean;
  /** Real stored tier: marks that tier's card as the current plan and names it in the banner. */
  currentTier?: AccessTier;
}

/**
 * Read-only entitlement view. Purchases and cancellation happen in the App Store / Google Play;
 * RevenueCat is the only writer of the tier doc and this page only reads it (Razorpay retired
 * 2026-09-25).
 */
export const SubscriptionPage: FC<SubscriptionPageProps> = ({ userId, isPaidMember = false, currentTier }) => {
  const ownership = useSubscriptionOwnership(userId);
  // Unknown tier + unpaid is FREE; unknown tier + paid marks no card (legacy boolean-only callers).
  const activeTier: AccessTier | undefined = currentTier ?? (isPaidMember ? undefined : 'FREE');

  return (
    <div className="w-full space-y-8" data-testid="subscription-page">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
          <Award className="w-4 h-4" />
          <span>{strings.subscription.title}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {strings.subscription.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto">
          {strings.subscription.subtitle}
        </p>
      </div>

      {/* Success Notification Banner */}
      {isPaidMember && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-3" data-testid="subscription-success-banner">
          <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">{strings.subscription.membershipActiveBadge}</p>
            {currentTier && currentTier !== 'FREE' && (
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300" data-testid="subscription-plan-name">
                {strings.subscription.yourPlan(tierPlanTitle(currentTier))}
              </p>
            )}
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{strings.subscription.membershipActiveDescription}</p>
            {/* Real renewal status, once RevenueCat has populated expiryDate -- legacy docs with no
                expiryDate show nothing here rather than a fabricated date. */}
            {ownership.expiryDate !== null && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400" data-testid="subscription-renewal-status">
                {ownership.willRenew
                  ? strings.subscription.renewsOn(new Date(ownership.expiryDate).toLocaleDateString())
                  : strings.subscription.expiresNoRenew(new Date(ownership.expiryDate).toLocaleDateString())}
              </p>
            )}

          </div>
        </div>
      )}

      {/* Store billing notice: always shown, this page cannot purchase or cancel */}
      <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-500/40 text-sky-800 dark:text-sky-300 flex items-center gap-3" data-testid="manage-in-store-notice">
        <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
        <p className="text-xs font-medium">{strings.subscription.manageInStore}</p>
      </div>

      {/*
        Tier Comparison Grid -- one card per SUBSCRIPTION_TIERS entry (FREE/BASIC/PRO/PREMIUM),
        the same content source PaymentRibbon.tsx uses (contracts/pricing.yaml via
        strings/common.ts), so this page and the ribbon can't drift on tiers/prices/features again.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isFree = tier.id === 'FREE';
          const testIdBase = tier.id.toLowerCase();
          return (
            <div
              key={tier.id}
              className={`relative p-8 rounded-3xl bg-white dark:bg-slate-800/90 border ${
                tier.isPopular
                  ? 'border-2 border-sky-500 shadow-xl shadow-sky-600/10'
                  : 'border-slate-200 dark:border-slate-700/80 shadow-md'
              } dark:shadow-xl dark:shadow-slate-950/60 flex flex-col justify-between`}
              data-testid={`${testIdBase}-tier-card`}
            >
              {tier.isPopular && (
                <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                  {strings.subscription.mostPopularBadge}
                </div>
              )}

              <div>
                <div className="space-y-2 mb-6">
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                    {tier.title}
                  </span>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{tier.price}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800 mb-8">
                  {tier.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {tier.id === activeTier ? (
                <button
                  disabled
                  className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-500/40 cursor-not-allowed text-center"
                  data-testid={isFree ? 'current-plan-btn' : `${testIdBase}-current-plan`}
                >
                  {strings.subscription.currentPlan}
                </button>
              ) : isFree ? null : (
                <div
                  className="w-full min-h-[44px] py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                  data-testid={`${testIdBase}-in-app-label`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>{strings.subscription.availableInApp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPage;
