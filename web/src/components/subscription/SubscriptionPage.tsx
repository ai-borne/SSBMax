import { FC } from 'react';
import { Check, ShieldCheck, Zap, AlertCircle, Award } from 'lucide-react';
import { strings } from '../../constants/strings';
import { usePaymentViewModel, PaymentState } from '../../viewmodels/PaymentViewModel';

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

  const handleUpgradeClick = async () => {
    await initiatePayment('pro_monthly');
    if (onPaymentSuccess && status === 'success') {
      onPaymentSuccess();
    }
  };

  const freeFeatures = [
    strings.subscription.freeFeature1,
    strings.subscription.freeFeature2,
    strings.subscription.freeFeature3
  ];

  const proFeatures = [
    strings.subscription.proFeature1,
    strings.subscription.proFeature2,
    strings.subscription.proFeature3,
    strings.subscription.proFeature4,
    strings.subscription.proFeature5
  ];

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
            <p className="font-bold text-sm">PRO Membership Active</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">You have unlocked full access to all Stage-I & Stage-II simulators and Gemini 2.5 Flash AI assessments.</p>
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

      {/* Tier Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Tier 1: Free Candidate Plan */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl flex flex-col justify-between" data-testid="free-tier-card">
          <div>
            <div className="space-y-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                {strings.subscription.freePlanTitle}
              </span>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{strings.subscription.freePlanPrice}</span>
                <span className="text-xs text-slate-500 font-medium">/ forever free</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Basic practice for Stage-I screening tests.</p>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800 mb-8">
              {freeFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            disabled
            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed text-center"
            data-testid="current-plan-btn"
          >
            {strings.subscription.currentPlan}
          </button>
        </div>

        {/* Tier 2: Officer Pass (PRO Plan) */}
        <div className="relative p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-sky-500 shadow-xl shadow-sky-600/10 dark:shadow-sky-950/50 flex flex-col justify-between" data-testid="pro-tier-card">
          <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md">
            Most Popular
          </div>

          <div>
            <div className="space-y-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 text-xs font-bold uppercase tracking-wider border border-sky-500/30">
                {strings.subscription.proPlanTitle}
              </span>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{strings.subscription.proPlanPrice}</span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Complete SSB psychology battery & AI assessor dossier reports.</p>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800 mb-8">
              {proFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs text-slate-800 dark:text-slate-200 font-medium">
                  <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpgradeClick}
            disabled={isLoading || isPaidMember}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isPaidMember
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-600/20'
            }`}
            data-testid="upgrade-pro-button"
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
                <span>{strings.subscription.upgradeNow}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
