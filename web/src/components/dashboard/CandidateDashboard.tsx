import { FC, useState } from 'react';
import { Shield, Award, Activity, Play, FileText, CheckCircle2, Settings, Sparkles, Compass } from 'lucide-react';
import { strings } from '../../constants/strings';
import { DiagnosticProfile } from '../../types/candidate';
import { DiagnosticModal } from '../onboarding/DiagnosticModal';

export interface CandidateDashboardProps {
  profile?: DiagnosticProfile;
  onUpdateProfile?: (profile: DiagnosticProfile) => void;
  onLaunchTest?: (testType: 'oir' | 'ppdt' | 'psychology') => void;
  onViewReports?: () => void;
}

export const CandidateDashboard: FC<CandidateDashboardProps> = ({
  profile,
  onUpdateProfile,
  onLaunchTest,
  onViewReports
}) => {
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<DiagnosticProfile>(
    profile || {
      targetBoard: 'army',
      entryStream: 'cds',
      prepLevel: 'intermediate',
      targetMonth: '2026-10',
      isCompleted: true
    }
  );

  const handleSaveProfile = (newProfile: DiagnosticProfile) => {
    setCurrentProfile(newProfile);
    onUpdateProfile?.(newProfile);
  };

  const getBoardTitle = (boardKey: DiagnosticProfile['targetBoard']) => {
    switch (boardKey) {
      case 'navy': return strings.diagnostic.boardNavy;
      case 'airforce': return strings.diagnostic.boardAirForce;
      default: return strings.diagnostic.boardArmy;
    }
  };

  const getEntryTitle = (entryKey: DiagnosticProfile['entryStream']) => {
    switch (entryKey) {
      case 'nda': return strings.diagnostic.entryNda;
      case 'afcat': return strings.diagnostic.entryAfcat;
      case 'tes_tgc': return strings.diagnostic.entryTesTgc;
      case 'ncc': return strings.diagnostic.entryNcc;
      default: return strings.diagnostic.entryCds;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="candidate-dashboard">
      {/* Header & Target Overview Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <Shield className="w-4 h-4" />
              <span>{strings.dashboard.title}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {strings.auth.welcomeBack} Officer Candidate
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{strings.dashboard.subtitle}</p>
          </div>

          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/60 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm self-start md:self-auto"
            data-testid="edit-diagnostic-btn"
          >
            <Settings className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{strings.dashboard.editProfile}</span>
          </button>
        </div>

        {/* Diagnostic Meta Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/60 text-xs">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium block mb-0.5">{strings.dashboard.targetBoard}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5" data-testid="meta-board">
              <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              {getBoardTitle(currentProfile.targetBoard)}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium block mb-0.5">{strings.dashboard.entryStream}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5" data-testid="meta-entry">
              <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {getEntryTitle(currentProfile.entryStream)}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium block mb-0.5">{strings.dashboard.readinessScore}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5" data-testid="meta-readiness">
              <Activity className="w-3.5 h-3.5" />
              78% (Ready)
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium block mb-0.5">{strings.dashboard.prepStatus}</span>
            <span className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5" data-testid="meta-status">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              {currentProfile.prepLevel.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Stage I & Stage II Simulator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage I Screening Card */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg flex flex-col justify-between" data-testid="stage1-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/30 text-[11px] font-bold uppercase tracking-wider">
                Stage 1
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Simulators
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{strings.dashboard.stage1Title}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{strings.dashboard.stage1Sub}</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => onLaunchTest?.('oir')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 dark:shadow-sky-900/30"
              data-testid="launch-oir-btn"
            >
              <span className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                {strings.dashboard.startOirSim}
              </span>
              <span className="text-[10px] bg-sky-800 px-2 py-0.5 rounded font-mono">50 Qs / 30m</span>
            </button>

            <button
              onClick={() => onLaunchTest?.('ppdt')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/60 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all"
              data-testid="launch-ppdt-btn"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                {strings.dashboard.startPpdtSim}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">30s view / 4m write</span>
            </button>
          </div>
        </div>

        {/* Stage II Psychology Battery Card */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg flex flex-col justify-between" data-testid="stage2-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider">
                Stage 2
              </span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Gemini 2.5 Flash AI
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{strings.dashboard.stage2Title}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{strings.dashboard.stage2Sub}</p>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => onLaunchTest?.('psychology')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs transition-all shadow-md shadow-amber-600/20 dark:shadow-amber-950/40"
              data-testid="launch-psych-btn"
            >
              <span className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                {strings.dashboard.startPsychBattery}
              </span>
              <span className="text-[10px] bg-amber-800/80 px-2 py-0.5 rounded font-mono">TAT + WAT + SRT + SD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent AI Reports Overview */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            {strings.dashboard.recentReports}
          </h2>
          <button
            onClick={onViewReports}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors"
            data-testid="view-reports-btn"
          >
            {strings.dashboard.viewFullReport}
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">{strings.dashboard.noReports}</p>
        </div>
      </div>

      {/* Diagnostic Onboarding Modal */}
      <DiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        onSaveProfile={handleSaveProfile}
        initialProfile={currentProfile}
      />
    </div>
  );
};

export default CandidateDashboard;
