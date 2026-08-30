import { FC, useState } from 'react';
import { Check, ShieldCheck, Zap, AlertCircle, Award, Info, XCircle } from 'lucide-react';
import { strings } from '../../constants/strings';
import { usePaymentViewModel } from '../../viewmodels/PaymentViewModel';
import { useSubscriptionOwnership, isActiveMobileSubscription } from '../../viewmodels/useSubscriptionOwnership';
import { SUBSCRIPTION_TIERS } from '../../constants/ssbSelectionProcess';
import { SubscriptionRepository } from '../../repositories/SubscriptionRepository';

type CancelStatus = 'idle' | 'confirming' | 'cancelling' | 'success' | 'error';

export interface SubscriptionPageProps {
  userId?: string;
  /** Real Firestore-backed tier, computed once in `App.tsx` (`isPaidMember = realTier !== 'FREE'`)
   * and passed down -- NOT `usePaymentViewModel`'s own `isPaidMember`, which is session-local and
   * only ever flips true immediately after a successful checkout in this same session, defaulting
   * false otherwise. Using the real value means "Membership Active" / disabled buttons show
   * correctly on a hard reload, not just right after a purchase. */
  isPaidMember?: boolean;
  onPaymentSuccess?: () => void;
  createOrderFn?: (planId: string) => Promise<{ orderId: string; amount: number; currency: string; keyId: string }>;
  /** Phase B (Razorpay Subscriptions API migration): real-subscription checkout path, isolated
   * from `createOrderFn`'s one-time-Order path -- see `usePaymentViewModel`'s doc comment. */
  createSubscriptionFn?: (planId: string) => Promise<{ subscriptionId: string; keyId: string }>;
  /** Checkout-cutover kill switch (`razorpay_subscriptions_checkout` feature flag) -- defaults
   * `false` (old order-based path) when the caller doesn't pass a live flag value. */
  useSubscriptionCheckout?: boolean;
  /** Phase 5 (H5a): `PaymentService.cancelSubscription` (`functions/src/razorpaySubscriptionCancel.js`).
   * Shown only for an active Razorpay-sourced subscription with `willRenew === true` -- a
   * RevenueCat-sourced one is cancelled via the mobile app (store-managed, Phase 6). */
  cancelSubscriptionFn?: () => Promise<{ success: boolean; subscriptionId: string }>;
}

export const SubscriptionPage: FC<SubscriptionPageProps> = ({
  userId,
  isPaidMember = false,
  onPaymentSuccess,
  createOrderFn,
  createSubscriptionFn,
  useSubscriptionCheckout = false,
  cancelSubscriptionFn
}) => {
  // L5 (Payment Ecosystem Hardening plan, Phase 12): only wired when a real userId is known --
  // an anonymous/mock render (no userId, e.g. offline testing) keeps `usePaymentViewModel`'s
  // previous immediate-success fallback rather than polling a tier read that has nothing to key on.
  const verifyTierFn = userId ? () => new SubscriptionRepository().getTier(userId) : undefined;
  const paymentVM = usePaymentViewModel(createOrderFn, createSubscriptionFn, useSubscriptionCheckout, verifyTierFn);
  const { status, errorMessage, initiatePayment } = paymentVM;
  const isLoading = status === 'creating_order' || status === 'checkout_open' || status === 'verifying';

  // Phase 4 amendment (dual-purchase gate): neither payment webhook reconciles against what the
  // other already wrote to `data/subscription` -- see `SubscriptionRepository.getOwnership`'s doc
  // comment. Block a second, separate web purchase while an active mobile subscription exists.
  const ownership = useSubscriptionOwnership(userId);
  const blockedByMobileSubscription = isActiveMobileSubscription(ownership);

  const [cancelStatus, setCancelStatus] = useState<CancelStatus>('idle');
  // Only a Razorpay-sourced, still-auto-renewing subscription has anything to cancel here --
  // a RevenueCat-sourced one is store-managed (mobile), and one already `willRenew: false`
  // has nothing left for this action to do.
  const canCancel = ownership.source === 'RAZORPAY' && ownership.willRenew === true;

  const handleCancelSubscription = async () => {
    if (!cancelSubscriptionFn) return;
    setCancelStatus('cancelling');
    try {
      await cancelSubscriptionFn();
      setCancelStatus('success');
      ownership.refresh();
    } catch {
      setCancelStatus('error');
    }
  };

  const handleUpgradeClick = async (tierId: string) => {
    if (blockedByMobileSubscription) return;
    await initiatePayment(`${tierId.toLowerCase()}_monthly`);
    if (onPaymentSuccess && status === 'success') {
      onPaymentSuccess();
    }
  };

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
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{strings.subscription.membershipActiveDescription}</p>
            {/* Phase B (Razorpay Subscriptions API migration): real renewal status, once a
                lifecycle webhook has populated expiryDate -- legacy/grandfathered docs with no
                expiryDate show nothing here rather than a fabricated date. */}
            {ownership.expiryDate !== null && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400" data-testid="subscription-renewal-status">
                {ownership.willRenew
                  ? strings.subscription.renewsOn(new Date(ownership.expiryDate).toLocaleDateString())
                  : strings.subscription.expiresNoRenew(new Date(ownership.expiryDate).toLocaleDateString())}
              </p>
            )}

            {/* Phase 5 (H5a): Razorpay-only cancellation -- see `canCancel`'s doc comment. */}
            {canCancel && cancelSubscriptionFn && cancelStatus === 'idle' && (
              <button
                onClick={() => setCancelStatus('confirming')}
                className="mt-2 text-xs font-bold text-rose-700 dark:text-rose-400 underline underline-offset-2"
                data-testid="cancel-subscription-link"
              >
                {strings.subscription.cancelSubscription}
              </button>
            )}
            {canCancel && cancelStatus === 'confirming' && (
              <div className="mt-3 p-3 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-emerald-300 dark:border-emerald-500/30" data-testid="cancel-subscription-confirm">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{strings.subscription.cancelConfirmTitle}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{strings.subscription.cancelConfirmBody}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCancelSubscription}
                    className="px-3 py-2 min-h-[44px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                    data-testid="cancel-subscription-confirm-button"
                  >
                    {strings.subscription.cancelConfirmButton}
                  </button>
                  <button
                    onClick={() => setCancelStatus('idle')}
                    className="px-3 py-2 min-h-[44px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                    data-testid="cancel-subscription-keep-button"
                  >
                    {strings.subscription.cancelKeepButton}
                  </button>
                </div>
              </div>
            )}
            {cancelStatus === 'cancelling' && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">{strings.subscription.cancelInProgress}</p>
            )}
            {cancelStatus === 'success' && (
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-2" data-testid="cancel-subscription-success">
                {strings.subscription.cancelSuccess}
              </p>
            )}
            {cancelStatus === 'error' && (
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mt-2 flex items-center gap-1" data-testid="cancel-subscription-error">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {strings.subscription.cancelError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mobile Subscription Active Banner (Phase 4 amendment, dual-purchase gate) */}
      {blockedByMobileSubscription && (
        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-500/40 text-sky-800 dark:text-sky-300 flex items-center gap-3" data-testid="mobile-subscription-active-banner">
          <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
          <p className="text-xs font-medium">{strings.subscription.mobileSubscriptionActiveBanner}</p>
        </div>
      )}

      {/* Error Notification Banner */}
      {status === 'error' && errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 flex items-center gap-3" data-testid="subscription-error-banner">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-xs font-medium">{errorMessage}</p>
        </div>
      )}

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

              {isFree ? (
                <button
                  disabled
                  className="w-full min-h-[44px] py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed text-center"
                  data-testid="current-plan-btn"
                >
                  {strings.subscription.currentPlan}
                </button>
              ) : (
                <button
                  onClick={() => handleUpgradeClick(tier.id)}
                  disabled={isLoading || isPaidMember || blockedByMobileSubscription}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isPaidMember
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-600/20'
                  }`}
                  data-testid={`upgrade-${testIdBase}-button`}
                >
                  {isLoading ? (
                    <span>{strings.subscription.initiatingRazorpay}</span>
                  ) : isPaidMember ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{strings.subscription.passActive}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>{tier.buttonText}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPage;
