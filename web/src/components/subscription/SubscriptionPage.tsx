import { FC } from 'react';
import { Check, ShieldCheck, Zap, AlertCircle, Award } from 'lucide-react';
import { strings } from '../../constants/strings';
import { usePaymentViewModel, PaymentState } from '../../viewmodels/PaymentViewModel';
import { SUBSCRIPTION_TIERS } from '../../constants/ssbSelectionProcess';

export interface SubscriptionPageProps {
  initialState?: Partial<PaymentState>;
  onPaymentSuccess?: () => void;
  createOrderFn?: (planId: string) => Promise<{ orderId: string; amount: number; currency: string; keyId: string }>;
}

export const SubscriptionPage: FC<SubscriptionPageProps> = ({
  onPaymentSuccess,
  createOrderFn
}) => {
  const paymentVM = usePaymentViewModel(createOrderFn);
  const { status, errorMessage, isPaidMember, initiatePayment } = paymentVM;
  const isLoading = status === 'creating_order' || status === 'checkout_open' || status === 'verifying';

  const handleUpgradeClick = async (tierId: string) => {
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
          <div>
            <p className="font-bold text-sm">Membership Active</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">You have unlocked full access to your plan's Stage-I & Stage-II simulators and AI assessments.</p>
          </div>
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
                  Most Popular
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
                  disabled={isLoading || isPaidMember}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isPaidMember
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-600/20'
                  }`}
                  data-testid={`upgrade-${testIdBase}-button`}
                >
                  {isLoading ? (
                    <span>Initiating Razorpay...</span>
                  ) : isPaidMember ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Pass Active</span>
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
