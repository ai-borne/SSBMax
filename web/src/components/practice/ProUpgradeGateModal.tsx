import { FC } from 'react';
import { ShieldCheck, Award, Zap, ArrowRight } from 'lucide-react';
import { BaseModal } from '../common/BaseModal';

export interface ProUpgradeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const ProUpgradeGateModal: FC<ProUpgradeGateModalProps> = ({
  isOpen,
  onClose,
  onUpgrade
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Unlock Pro Officer Pass"
      testId="pro-upgrade-gate-modal"
      ariaLabelledBy="pro-gate-title"
    >
      <div className="space-y-5 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-tr from-amber-500/10 to-amber-500/5 p-4 rounded-2xl border border-amber-500/30">
          <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 shrink-0">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white uppercase tracking-widest">
              PRO PASS REQUIRED
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              Unlimited AI Assessor Evaluations
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Access Stage II TAT, WAT, SRT, SD batteries and full 15 OLQ radar reports.
            </p>
          </div>
        </div>

        <ul className="space-y-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <li className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Full Stage II Psychology Test Batteries (TAT 12, WAT 60, SRT 60, SD 5)</span>
          </li>
          <li className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Instant Assessor Dossier & 15 Officer Like Qualities (OLQ) Breakdowns</span>
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>100% Refund Policy & 256-Bit Razorpay Encryption Guarantee</span>
          </li>
        </ul>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              onUpgrade();
            }}
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all"
            data-testid="upgrade-pro-cta-button"
          >
            <span>Upgrade to Pro Officer Pass</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default ProUpgradeGateModal;
