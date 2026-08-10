import React, { useEffect, useState } from 'react';
import { OIRTestViewModel, OIRTestState } from '../../viewmodels/OIRTestViewModel';
import { useTestTimer } from '../../hooks/useTestTimer';
import { strings } from '../../constants/strings';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { AntiCheatWarningBanner } from '../common/AntiCheatWarningBanner';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, Send, AlertTriangle, LogOut } from 'lucide-react';

export interface OIRTestRunnerProps {
  viewModel: OIRTestViewModel;
  userId: string;
  isOnline?: boolean;
  batchIndex?: number;
  onExitTest?: () => void;
}

export const OIRTestRunner: React.FC<OIRTestRunnerProps> = ({
  viewModel,
  userId,
  isOnline = true,
  batchIndex = 0,
  onExitTest
}) => {
  const [state, setState] = useState<OIRTestState>(viewModel.getState());
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => {
      setState(viewModel.getState());
    });
    viewModel.loadQuestions(batchIndex);
    return () => unsubscribe();
  }, [viewModel, batchIndex]);


  const { formattedTime, start } = useTestTimer({
    initialSeconds: 30 * 60,
    autoStart: true,
    onComplete: () => {
      viewModel.submitTest(userId, isOnline);
    }
  });

  useEffect(() => {
    start();
  }, [start]);

  const isTestActive = !state.isLoading && !state.error && !state.isCompleted;
  const { warningMessage } = useAntiCheat({
    isActive: isTestActive,
    onViolationExceeded: () => viewModel.submitTest(userId, isOnline)
  });

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-[var(--color-text-muted)]">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        <span>{strings.common.loading}</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-lg text-red-300 flex items-center justify-between">
        <span>{state.error}</span>
        <button
          onClick={() => viewModel.loadQuestions(0)}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-white text-sm"
        >
          {strings.common.retry}
        </button>
      </div>
    );
  }

  if (state.isCompleted && state.result) {
    return (
      <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center max-w-lg mx-auto">
        <CheckCircle2 className="w-16 h-16 text-[var(--color-success)] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">{strings.oir.completedTitle}</h2>
        <div className="my-6 p-4 bg-[var(--color-bg-elevated)] rounded-lg flex justify-around">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{strings.oir.scoreLabel}</p>
            <p className="text-3xl font-extrabold text-[var(--color-accent)]">
              {state.result.score} / {state.result.totalQuestions}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{strings.oir.ratingLabel}</p>
            <p className="text-3xl font-extrabold text-[var(--color-success)]">
              OIR-{state.result.oirRating}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) {
    return <div className="p-6 text-[var(--color-text-muted)]">{strings.oir.noQuestions}</div>;
  }

  const selectedIndex = state.answers[currentQuestion.id];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AntiCheatWarningBanner message={warningMessage} />
      {/* Timer, Status & Exit Header */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{strings.oir.title}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {strings.oir.questionCount
              .replace('{current}', String(state.currentIndex + 1))
              .replace('{total}', String(state.questions.length))}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {!isOnline && (
            <span className="flex items-center text-xs px-2.5 py-1 bg-amber-900/30 text-[var(--color-warning)] border border-amber-800/50 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {strings.oir.requiresOnline}
            </span>
          )}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border)]">
            <Clock className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="font-mono text-sm text-[var(--color-accent)] font-medium">{formattedTime}</span>
          </div>
          {onExitTest && (
            <button
              onClick={() => setShowExitModal(true)}
              className="flex items-center px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              {strings.exitTest.exitButton}
            </button>
          )}
        </div>
      </div>

      {/* Question Card */}
      <div className="p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-6">
        {currentQuestion.imageUrl && (
          <img
            src={currentQuestion.imageUrl}
            alt="Question Diagram"
            className="max-h-64 mx-auto rounded border border-[var(--color-border)] object-contain"
          />
        )}
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">{currentQuestion.questionText}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => viewModel.selectOption(currentQuestion.id, idx)}
                className={`flex items-center p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg-elevated)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-subtle)]'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mr-3 ${
                    isSelected ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => viewModel.previousQuestion()}
          disabled={state.currentIndex === 0}
          className="flex items-center px-4 py-2 bg-[var(--color-bg-elevated)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-lg text-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {strings.common.back}
        </button>

        <div className="flex space-x-2">
          {state.currentIndex < state.questions.length - 1 ? (
            <button
              onClick={() => viewModel.nextQuestion()}
              className="flex items-center px-5 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-lg text-sm font-medium"
            >
              {strings.common.next}
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={() => viewModel.submitTest(userId, isOnline)}
              disabled={state.isSubmitting}
              className="flex items-center px-6 py-2 bg-[var(--color-success)] hover:opacity-90 text-white rounded-lg text-sm font-medium"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {state.isSubmitting ? strings.oir.submitting : strings.oir.submitTest}
            </button>
          )}
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              {strings.exitTest.confirmTitle}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {strings.exitTest.confirmMessage}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]"
              >
                {strings.exitTest.cancelButton}
              </button>
              <button
                onClick={() => {
                  setShowExitModal(false);
                  if (onExitTest) onExitTest();
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {strings.exitTest.confirmButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
