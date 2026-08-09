import { FC } from 'react';
import { ChevronLeft, ChevronRight, Grid, Bookmark, CheckCircle2 } from 'lucide-react';

export interface TestRunnerBottomBarProps {
  currentIndex: number;
  totalQuestions: number;
  isFlagged?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleGrid: () => void;
  onToggleFlag: () => void;
  onSubmit: () => void;
}

export const TestRunnerBottomBar: FC<TestRunnerBottomBarProps> = ({
  currentIndex,
  totalQuestions,
  isFlagged = false,
  onPrev,
  onNext,
  onToggleGrid,
  onToggleFlag,
  onSubmit
}) => {
  return (
    <footer
      className="h-14 w-full bg-slate-900 text-white px-4 flex items-center justify-between border-t border-slate-800 shadow-lg shrink-0"
      data-testid="test-runner-bottom-bar"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 transition-colors"
          data-testid="runner-prev-button"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <button
          onClick={onToggleGrid}
          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
          data-testid="runner-grid-toggle-button"
        >
          <Grid className="w-4 h-4 text-sky-400" />
          <span className="font-mono text-[11px]">{currentIndex + 1}/{totalQuestions}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFlag}
          className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border ${
            isFlagged
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
          data-testid="runner-flag-button"
        >
          <Bookmark className={`w-4 h-4 ${isFlagged ? 'fill-amber-400' : ''}`} />
          <span className="hidden sm:inline">{isFlagged ? 'Flagged' : 'Flag'}</span>
        </button>

        {currentIndex < totalQuestions - 1 ? (
          <button
            onClick={onNext}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
            data-testid="runner-next-button"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
            data-testid="runner-submit-button"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Test</span>
          </button>
        )}
      </div>
    </footer>
  );
};

export default TestRunnerBottomBar;
