import { FC, useState, useEffect } from 'react';
import { ArrowLeft, Clock, ShieldCheck, Play, Award, CheckCircle2 } from 'lucide-react';
import { getTestConfigById } from '../practice/ssbTestConfigs';
import { strings } from '../../constants/strings';
import { GTOResponseForm } from './GTOResponseForm';
import { InterviewResponseCapture } from './InterviewResponseCapture';

export interface GTOTaskGuideRunnerProps {
  testId: string;
  onExitTest: () => void;
}

export const GTOTaskGuideRunner: FC<GTOTaskGuideRunnerProps> = ({
  testId,
  onExitTest,
}) => {
  const config = getTestConfigById(testId);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (!config) return;
    const minutesMatch = config.timeLimit.match(/\d+/);
    const mins = minutesMatch ? parseInt(minutesMatch[0], 10) : 30;
    setSecondsRemaining(mins * 60);
  }, [config]);

  useEffect(() => {
    if (!isRunning || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, secondsRemaining]);

  if (!config) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Task configuration not found for {testId}.</p>
        <button onClick={onExitTest} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-white text-xs">
          {strings.common.back}
        </button>
      </div>
    );
  }

  if (secondsRemaining <= 0) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center max-w-lg mx-auto space-y-6 shadow-xl my-8 text-white">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-white mb-1">{config.title} Completed</h2>
          <p className="text-xs text-slate-400 leading-relaxed">Timed task simulation finished. Great job practicing your GTO / Interview execution!</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button
            onClick={onExitTest}
            data-testid="return-to-tests-button"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to SSB Tests</span>
          </button>
        </div>
      </div>
    );
  }

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" data-testid={`gto-runner-${testId}`}>
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          onClick={onExitTest}
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{strings.common.back}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            {config.stageBadge}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-goldSubtle text-gold border border-gold/40">
            {config.shortCode}
          </span>
        </div>
      </div>

      {/* Main Task Card Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>{config.timeLimit}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {config.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            {config.description}
          </p>

          {/* OLQs Evaluated Badges */}
          {config.olqsEvaluated && config.olqsEvaluated.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Target Officer-Like Qualities (OLQs)
              </span>
              <div className="flex flex-wrap gap-2">
                {config.olqsEvaluated.map((olq) => (
                  <span
                    key={olq}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    {olq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Execution Guidelines & Strategy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rules & Protocol */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Standard Protocol & Guidelines</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>Adhere strictly to standard Assessor GTO rules (Cantilever, Color, Distance, and Out-of-Bounds).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>Maintain active team communication and cooperate with group members without dominating aggressively.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>Demonstrate practical problem solving, logical reasoning, and resource management.</span>
            </li>
          </ul>
        </div>

        {/* Tactical Simulator Controls */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Timed Task Simulator</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use the built-in timer to simulate actual SSB test conditions and practice your response allocation.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-2xl font-mono font-black text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
              {formatTimer(secondsRemaining)}
            </div>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>{isRunning ? 'Pause Timer' : 'Start Simulator'}</span>
            </button>
          </div>
        </div>
      </div>

      {config.contractTestType?.startsWith('GTO_') && (
        <GTOResponseForm gtoType={config.contractTestType} topic={config.title} />
      )}
      {testId === 'interview' && <InterviewResponseCapture questionId={testId} />}
    </div>
  );
};

export default GTOTaskGuideRunner;
