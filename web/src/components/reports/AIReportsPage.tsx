import React, { useState } from 'react';
import { strings } from '../../constants/strings';
import { InteractiveRadarChart } from '../evaluation/InteractiveRadarChart';
import { PsychologistDossier, PsychologistDossierData } from '../evaluation/PsychologistDossier';
import { OLQScoreCard, OLQScoreItem } from '../evaluation/OLQScoreCard';
import { Sparkles, Lock, ArrowRight, History, Eye, UserCheck } from 'lucide-react';

export interface AIReportAttempt {
  id: string;
  testType: string;
  date: string;
  scoreOrRating: string;
}

export interface AIReportsPageProps {
  userReports?: {
    olqScores: OLQScoreItem[];
    dossier: PsychologistDossierData;
  } | null;
  recentAttempts?: AIReportAttempt[];
  isGuest?: boolean;
  onSignIn?: () => void;
  onStartTest?: () => void;
}

const SAMPLE_OLQ_SCORES: OLQScoreItem[] = [
  { olq: 'EFFECTIVE_INTELLIGENCE', score: 8.5, reasoning: 'Demonstrated analytical clarity in tactical scenario reactions.' },
  { olq: 'REASONING_ABILITY', score: 8.0, reasoning: 'Logically structured response patterns during situation tests.' },
  { olq: 'ORGANIZING_ABILITY', score: 7.5, reasoning: 'Organized resources effectively in team scenarios.' },
  { olq: 'POWER_OF_EXPRESSION', score: 8.2, reasoning: 'Articulate narrative structure in TAT stories.' },
  { olq: 'SOCIAL_ADJUSTMENT', score: 7.8, reasoning: 'Adaptable social demeanor across diverse situations.' },
  { olq: 'COOPERATION', score: 8.4, reasoning: 'Strong group cohesion orientation.' },
  { olq: 'SENSE_OF_RESPONSIBILITY', score: 8.6, reasoning: 'Proactive ownership of group goals.' },
  { olq: 'INITIATIVE', score: 8.1, reasoning: 'Spontaneous problem-solving responses.' },
  { olq: 'SELF_CONFIDENCE', score: 7.9, reasoning: 'Poised and decisive tone.' },
  { olq: 'SPEED_OF_DECISION', score: 7.6, reasoning: 'Prompt reaction times in SRT.' },
  { olq: 'INFLUENCE_GROUP', score: 7.7, reasoning: 'Natural group influence and direction.' },
  { olq: 'LIVELINESS', score: 8.0, reasoning: 'Energetic and positive outlook.' },
  { olq: 'DETERMINATION', score: 8.3, reasoning: 'Persistent approach to obstacles.' },
  { olq: 'COURAGE', score: 8.2, reasoning: 'Moral and physical courage in situation responses.' },
  { olq: 'STAMINA', score: 7.8, reasoning: 'Sustained focus throughout 60-situation battery.' }
];

const SAMPLE_DOSSIER: PsychologistDossierData = {
  candidateId: 'CADET-DEMO-2026',
  assessedDate: '2026-08-08',
  recommendationStatus: 'RECOMMENDED',
  executiveSummary: 'Candidate exhibits high intellectual efficacy, sound reasoning under pressure, and strong social adaptability. Psychological responses reflect maturity, moral courage, and alignment with Services Selection Board expectations.',
  keyStrengths: [
    'Quick decision-making in high-stress situations',
    'Clear and articulate expression in TAT stories',
    'High sense of responsibility and team orientation'
  ],
  areasOfConcern: [
    'Slight tendency to rush initial organizing steps under tight time bounds'
  ],
  suggestedProbes: [
    'Probe candidate on handling conflicting priorities during group tasks',
    'Evaluate delegation strategies when managing subordinate teams'
  ]
};

export const AIReportsPage: React.FC<AIReportsPageProps> = ({
  userReports,
  recentAttempts = [],
  isGuest = false,
  onSignIn,
  onStartTest
}) => {
  const [showSample, setShowSample] = useState(!userReports);

  const activeReports = showSample || !userReports ? null : userReports;
  const olqData = activeReports?.olqScores || SAMPLE_OLQ_SCORES;
  const dossierData = activeReports?.dossier || SAMPLE_DOSSIER;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8" data-testid="ai-reports-page">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span>{strings.reportsPage.title}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {strings.reportsPage.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto">
          {strings.reportsPage.subtitle}
        </p>
      </div>

      {/* Guest Auth Banner */}
      {isGuest && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm" data-testid="guest-banner">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{strings.reportsPage.guestBanner}</span>
          </div>
          <button
            onClick={onSignIn}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors shrink-0"
            data-testid="guest-signin-btn"
          >
            {strings.reportsPage.signInAction}
          </button>
        </div>
      )}

      {/* Sample Banner if no user report or viewing sample */}
      {(showSample || !userReports) && (
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[10px] font-bold uppercase tracking-wider">
              {strings.reportsPage.sampleBadge}
            </span>
            <span>{strings.reportsPage.sampleBanner}</span>
          </div>
          {onStartTest && (
            <button
              onClick={onStartTest}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>{strings.reportsPage.startTest}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Controls Bar: Toggle Sample & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
        {userReports && (
          <button
            onClick={() => setShowSample(!showSample)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-2"
          >
            {showSample ? (
              <>
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{strings.reportsPage.toggleUser}</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>{strings.reportsPage.toggleSample}</span>
              </>
            )}
          </button>
        )}

        {onStartTest && (
          <button
            onClick={onStartTest}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md"
            data-testid="take-new-test-btn"
          >
            <span>{strings.reportsPage.startTest}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Sections: Radar Chart, Dossier & Score Card */}
      <div className="space-y-8">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4" data-testid="radar-view">
          <InteractiveRadarChart scores={olqData} />
        </div>

        <div data-testid="dossier-view">
          <PsychologistDossier dossier={dossierData} />
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4" data-testid="olq-view">
          <OLQScoreCard olqScores={olqData} />
        </div>
      </div>

      {/* Recent Assessment Attempts Table */}
      {recentAttempts.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4" data-testid="attempts-history">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <History className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2>{strings.reportsPage.historyTitle}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Test Type</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Score / Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {recentAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{attempt.testType}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{attempt.date}</td>
                    <td className="p-3 font-bold text-sky-600 dark:text-sky-400">{attempt.scoreOrRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReportsPage;
