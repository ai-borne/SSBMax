import { FC } from 'react';
import { LogOut, Clock, Database } from 'lucide-react';
import { strings } from '../../../constants/strings';

export interface TestRunnerHeaderProps {
  testTitle: string;
  timeLeftSeconds: number;
  isOfflineSaved?: boolean;
  onExitClick: () => void;
}

export const TestRunnerHeader: FC<TestRunnerHeaderProps> = ({
  testTitle,
  timeLeftSeconds,
  isOfflineSaved = true,
  onExitClick
}) => {
  const mins = Math.floor(timeLeftSeconds / 60);
  const secs = timeLeftSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <header
      className="h-12 w-full bg-slate-900 text-white px-4 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0"
      data-testid="test-runner-header"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onExitClick}
          className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 text-xs font-bold"
          aria-label={strings.testRunner.header.exitAriaLabel}
          data-testid="runner-exit-button"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline">{strings.testRunner.header.exit}</span>
        </button>
        <span className="text-xs font-black tracking-wider uppercase text-slate-200 border-l border-slate-800 pl-3">
          {testTitle}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* IndexedDB Auto-Save Badge */}
        {isOfflineSaved && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>{strings.testRunner.header.offlineAutoSave}</span>
          </div>
        )}

        {/* Timer Countdown */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
            timeLeftSeconds < 120
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
              : 'bg-slate-800 text-sky-400 border-slate-700'
          }`}
          data-testid="runner-timer-display"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeFormatted}</span>
        </div>
      </div>
    </header>
  );
};

export default TestRunnerHeader;
