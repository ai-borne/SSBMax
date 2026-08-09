import { FC } from 'react';
import { X, Bookmark } from 'lucide-react';

export interface QuestionStatus {
  index: number;
  isAnswered: boolean;
  isFlagged?: boolean;
}

export interface TestQuestionGridDrawerProps {
  isOpen: boolean;
  totalQuestions: number;
  currentIndex: number;
  questionStatuses: QuestionStatus[];
  onSelectQuestion: (index: number) => void;
  onClose: () => void;
}

export const TestQuestionGridDrawer: FC<TestQuestionGridDrawerProps> = ({
  isOpen,
  totalQuestions,
  currentIndex,
  questionStatuses,
  onSelectQuestion,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-0 animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="question-grid-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[70vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Question Palette ({totalQuestions} Total)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
            data-testid="close-drawer-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend Bar */}
        <div className="flex items-center justify-around text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-3 mb-4">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Current</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Answered</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Flagged</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Unanswered</span>
        </div>

        {/* 60 Question Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 overflow-y-auto p-1">
          {Array.from({ length: totalQuestions }).map((_, idx) => {
            const status = questionStatuses.find((s) => s.index === idx);
            const isCurrent = idx === currentIndex;
            const isAnswered = status?.isAnswered ?? false;
            const isFlagged = status?.isFlagged ?? false;

            return (
              <button
                key={idx}
                onClick={() => {
                  onSelectQuestion(idx);
                  onClose();
                }}
                className={`min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold font-mono transition-all flex flex-col items-center justify-center relative border ${
                  isCurrent
                    ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-400/40 shadow-lg'
                    : isAnswered
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : isFlagged
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
                data-testid={`grid-item-${idx}`}
              >
                <span>{idx + 1}</span>
                {isFlagged && <Bookmark className="w-2.5 h-2.5 text-amber-400 absolute top-1 right-1 fill-amber-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TestQuestionGridDrawer;
