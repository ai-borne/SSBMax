import { FC, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface LegalPageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  testIdPrefix: string;
  onBackClick?: () => void;
}

/** Banner shared by the Contact and Refund pages, matching the Privacy/Terms banner style. */
export const LegalPageHeader: FC<LegalPageHeaderProps> = ({ icon, title, subtitle, testIdPrefix, onBackClick }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">{icon}</div>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wide" data-testid={`${testIdPrefix}-title`}>{title}</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xl">{subtitle}</p>
      </div>
    </div>
    {onBackClick && (
      <button
        onClick={onBackClick}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600/50 transition-colors self-start md:self-center"
        data-testid={`${testIdPrefix}-back-button`}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{strings.common.back}</span>
      </button>
    )}
  </div>
);
