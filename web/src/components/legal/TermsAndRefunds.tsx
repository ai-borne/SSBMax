import { FC } from 'react';
import { FileText, Award, RefreshCw, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface TermsAndRefundsProps {
  onBackClick?: () => void;
}

export const TermsAndRefunds: FC<TermsAndRefundsProps> = ({ onBackClick }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide" data-testid="terms-title">
              {strings.terms.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {strings.terms.subtitle}
            </p>
          </div>
        </div>

        {onBackClick && (
          <button
            onClick={onBackClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600/50 transition-colors self-start md:self-center"
            data-testid="terms-back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{strings.common.back}</span>
          </button>
        )}
      </div>

      {/* Terms Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1 */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/50 text-sky-400">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">{strings.terms.sec1Title}</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{strings.terms.sec1Text}</p>
        </div>

        {/* Section 2 */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/50 text-emerald-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">{strings.terms.sec2Title}</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{strings.terms.sec2Text}</p>
        </div>

        {/* Section 3 */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/50 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">{strings.terms.sec3Title}</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{strings.terms.sec3Text}</p>
        </div>

        {/* Section 4 */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/50 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">{strings.terms.sec4Title}</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{strings.terms.sec4Text}</p>
        </div>
      </div>
    </div>
  );
};

export default TermsAndRefunds;
