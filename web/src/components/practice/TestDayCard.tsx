import { FC } from 'react';
import { Play, Lock, Clock } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface TestDayCardItem {
  id: 'oir' | 'ppdt' | 'psychology' | 'tat' | 'wat' | 'srt' | 'sd' | 'piq';
  title: string;
  desc: string;
  stage: string;
  isPro: boolean;
  timeLimit: string;
}

export interface TestDayCardProps {
  test: TestDayCardItem;
  isPaidMember: boolean;
  onLaunch: (testId: string) => void;
  onUnlockPro: () => void;
}

export const TestDayCard: FC<TestDayCardProps> = ({
  test,
  isPaidMember,
  onLaunch,
  onUnlockPro
}) => {
  const isLocked = test.isPro && !isPaidMember;

  const handleClick = () => {
    if (isLocked) {
      onUnlockPro();
    } else {
      onLaunch(test.id);
    }
  };

  return (
    <div
      className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-md shadow-slate-200/40 dark:shadow-lg flex flex-col justify-between"
      data-testid={`test-card-${test.id}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {test.stage.toUpperCase()}
          </span>
          {test.isPro ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              PRO
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              FREE
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{test.title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{test.desc}</p>
      </div>

      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          {test.timeLimit}
        </span>
        <button
          onClick={handleClick}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
            isLocked
              ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/40'
              : 'bg-sky-600 hover:bg-sky-500 text-white'
          }`}
          data-testid={`launch-test-${test.id}`}
        >
          {isLocked ? (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{strings.practice.proRequired}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>{strings.practice.startTest}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TestDayCard;
