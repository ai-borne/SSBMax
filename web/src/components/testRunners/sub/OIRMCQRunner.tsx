import React, { useEffect, useState } from 'react';
import { OIRTestViewModel, OIRTestState } from '../../../viewmodels/OIRTestViewModel';
import { useTestTimer } from '../../../hooks/useTestTimer';
import { strings } from '../../../constants/strings';
import { useAntiCheat } from '../../../hooks/useAntiCheat';
import { AntiCheatWarningBanner } from '../../common/AntiCheatWarningBanner';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react';

interface OIRMCQRunnerProps {
  viewModel: OIRTestViewModel;
  userId: string;
  isOnline?: boolean;
}

export const OIRMCQRunner: React.FC<OIRMCQRunnerProps> = ({
  viewModel,
  userId,
  isOnline = true
}) => {
  const [state, setState] = useState<OIRTestState>(viewModel.getState());

  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => {
      setState(viewModel.getState());
    });
    viewModel.loadQuestions(0);
    return () => unsubscribe();
  }, [viewModel]);

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
      <div className="flex items-center justify-center p-12 text-slate-400">
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
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center max-w-lg mx-auto">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">{strings.oir.completedTitle}</h2>
        <div className="my-6 p-4 bg-slate-800/60 rounded-lg flex justify-around">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{strings.oir.scoreLabel}</p>
            <p className="text-3xl font-extrabold text-sky-400">
              {state.result.score} / {state.result.totalQuestions}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{strings.oir.ratingLabel}</p>
            <p className="text-3xl font-extrabold text-emerald-400">
              OIR-{state.result.oirRating}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) {
    return <div className="p-6 text-slate-400">{strings.oir.noQuestions}</div>;
  }

  const selectedIndex = state.answers[currentQuestion.id];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AntiCheatWarningBanner message={warningMessage} />
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{strings.oir.title}</h2>
          <p className="text-xs text-slate-400">
            {strings.oir.questionCount
              .replace('{current}', String(state.currentIndex + 1))
              .replace('{total}', String(state.questions.length))}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {!isOnline && (
            <span className="flex items-center text-xs px-2.5 py-1 bg-amber-900/30 text-amber-300 border border-amber-800/50 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {strings.oir.requiresOnline}
            </span>
          )}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="font-mono text-sm text-sky-400 font-medium">{formattedTime}</span>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6">
        {currentQuestion.imageUrl && (
          <img
            src={currentQuestion.imageUrl}
            alt="Question Diagram"
            className="max-h-64 mx-auto rounded border border-slate-700 object-contain"
          />
        )}
        <h3 className="text-lg font-medium text-slate-100">{currentQuestion.questionText}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => viewModel.selectOption(currentQuestion.id, idx)}
                className={`flex items-center p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-sky-950/40 text-sky-200'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mr-3 ${
                    isSelected ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-300'
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

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => viewModel.previousQuestion()}
          disabled={state.currentIndex === 0}
          className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {strings.common.back}
        </button>

        <div className="flex space-x-2">
          {state.currentIndex < state.questions.length - 1 ? (
            <button
              onClick={() => viewModel.nextQuestion()}
              className="flex items-center px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium"
            >
              {strings.common.next}
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={() => viewModel.submitTest(userId, isOnline)}
              disabled={state.isSubmitting}
              className="flex items-center px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {state.isSubmitting ? strings.oir.submitting : strings.oir.submitTest}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
