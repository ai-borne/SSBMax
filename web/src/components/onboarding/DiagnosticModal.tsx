import { FC, useState } from 'react';
import { Target, Compass, Award, Calendar, CheckCircle, X } from 'lucide-react';
import { strings } from '../../constants/strings';
import { DiagnosticProfile } from '../../types/candidate';

export interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: DiagnosticProfile) => void;
  initialProfile?: Partial<DiagnosticProfile>;
}

export const DiagnosticModal: FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  onSaveProfile,
  initialProfile
}) => {
  const [board, setBoard] = useState<DiagnosticProfile['targetBoard']>(initialProfile?.targetBoard || 'army');
  const [entry, setEntry] = useState<DiagnosticProfile['entryStream']>(initialProfile?.entryStream || 'cds');
  const [prepLevel, setPrepLevel] = useState<DiagnosticProfile['prepLevel']>(initialProfile?.prepLevel || 'beginner');
  const [targetMonth, setTargetMonth] = useState<string>(initialProfile?.targetMonth || '2026-10');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      targetBoard: board,
      entryStream: entry,
      prepLevel: prepLevel,
      targetMonth: targetMonth,
      isCompleted: true
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      data-testid="diagnostic-modal-backdrop"
    >
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        data-testid="diagnostic-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">{strings.diagnostic.title}</h2>
              <p className="text-xs text-slate-400">{strings.diagnostic.subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            data-testid="close-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target Board */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Compass className="w-4 h-4 text-sky-400" />
              {strings.diagnostic.targetBoardLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'army', label: strings.diagnostic.boardArmy },
                { id: 'navy', label: strings.diagnostic.boardNavy },
                { id: 'airforce', label: strings.diagnostic.boardAirForce }
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setBoard(item.id as DiagnosticProfile['targetBoard'])}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                    board === item.id
                      ? 'bg-sky-600/30 border-sky-500 text-sky-200 font-bold shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  data-testid={`board-${item.id}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Entry Stream */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Award className="w-4 h-4 text-amber-400" />
              {strings.diagnostic.entryTypeLabel}
            </label>
            <select
              value={entry}
              onChange={(e) => setEntry(e.target.value as DiagnosticProfile['entryStream'])}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
              data-testid="entry-select"
            >
              <option value="nda">{strings.diagnostic.entryNda}</option>
              <option value="cds">{strings.diagnostic.entryCds}</option>
              <option value="afcat">{strings.diagnostic.entryAfcat}</option>
              <option value="tes_tgc">{strings.diagnostic.entryTesTgc}</option>
              <option value="ncc">{strings.diagnostic.entryNcc}</option>
            </select>
          </div>

          {/* Preparation Status */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {strings.diagnostic.prepLevelLabel}
            </label>
            <div className="space-y-2">
              {[
                { id: 'beginner', label: strings.diagnostic.prepBeginner },
                { id: 'intermediate', label: strings.diagnostic.prepIntermediate },
                { id: 'advanced', label: strings.diagnostic.prepAdvanced }
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    prepLevel === item.id
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-semibold'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <input
                    type="radio"
                    name="prepLevel"
                    value={item.id}
                    checked={prepLevel === item.id}
                    onChange={() => setPrepLevel(item.id as DiagnosticProfile['prepLevel'])}
                    className="accent-emerald-500"
                    data-testid={`prep-${item.id}`}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Target SSB Month */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              {strings.diagnostic.targetDateLabel}
            </label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
              data-testid="target-month-input"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              data-testid="cancel-modal-btn"
            >
              {strings.diagnostic.skipModal}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-900/40 transition-all"
              data-testid="save-modal-btn"
            >
              {strings.diagnostic.saveProfile}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiagnosticModal;
