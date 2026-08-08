import React, { useEffect, useState, useCallback } from 'react';
import { PsychologyTestViewModel, PsychologyTestState } from '../../../viewmodels/PsychologyTestViewModel';
import { useTestTimer } from '../../../hooks/useTestTimer';
import { strings } from '../../../constants/strings';
import { useAntiCheat } from '../../../hooks/useAntiCheat';
import { AntiCheatWarningBanner } from '../../common/AntiCheatWarningBanner';
import { Clock, CheckCircle2, ChevronRight, Send, AlertTriangle, Zap } from 'lucide-react';

interface WATWordViewerProps {
  viewModel: PsychologyTestViewModel;
  userId: string;
  isOnline?: boolean;
}

export const WATWordViewer: React.FC<WATWordViewerProps> = ({
  viewModel,
  userId,
  isOnline = true
}) => {
  const [state, setState] = useState<PsychologyTestState>(viewModel.getState());

  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => {
      setState(viewModel.getState());
    });
    viewModel.loadTestContent();
    return () => unsubscribe();
  }, [viewModel]);

  const currentSlide = state.slides[state.currentSlideIndex];

  const handleSlideComplete = useCallback(() => {
    const hasNext = viewModel.nextSlide();
    if (!hasNext) {
      viewModel.submitTest(userId, isOnline);
    }
  }, [viewModel, userId, isOnline]);

  const { formattedTime, reset } = useTestTimer({
    initialSeconds: currentSlide?.durationSeconds || 15,
    autoStart: true,
    onComplete: handleSlideComplete
  });

  useEffect(() => {
    if (currentSlide) {
      reset(currentSlide.durationSeconds);
    }
  }, [state.currentSlideIndex, currentSlide, reset]);

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
          onClick={() => viewModel.loadTestContent()}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-white text-sm"
        >
          {strings.common.retry}
        </button>
      </div>
    );
  }

  if (state.isCompleted) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center max-w-lg mx-auto">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">{strings.psychology.completedTitle}</h2>
        <p className="text-sm text-slate-400 mb-6">{strings.psychology.completedMessage}</p>
      </div>
    );
  }

  if (!currentSlide) return null;

  const currentResponse = state.responses[currentSlide.id] || '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AntiCheatWarningBanner message={warningMessage} />
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{strings.psychology.watTitle}</h2>
          <p className="text-xs text-slate-400">
            Word {state.currentSlideIndex + 1} of {state.slides.length}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {!isOnline && (
            <span className="flex items-center text-xs px-2.5 py-1 bg-amber-900/30 text-amber-300 border border-amber-800/50 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {strings.psychology.requiresOnline}
            </span>
          )}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="font-mono text-sm text-sky-400 font-medium">{formattedTime}</span>
          </div>
        </div>
      </div>

      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center min-h-[200px]">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2">
          <Zap className="w-4 h-4" />
          <span>Association Word Prompt</span>
        </div>
        <span className="text-4xl md:text-5xl font-black tracking-widest text-sky-200 uppercase py-4">
          {currentSlide.content}
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={currentResponse}
          onChange={(e) => viewModel.updateResponse(currentSlide.id, e.target.value)}
          placeholder={strings.psychology.writeResponsePlaceholder}
          className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-base"
          autoFocus
        />
      </div>

      <div className="flex justify-end">
        {state.currentSlideIndex < state.slides.length - 1 ? (
          <button
            onClick={() => handleSlideComplete()}
            className="flex items-center px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {strings.psychology.nextSlide}
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        ) : (
          <button
            onClick={() => viewModel.submitTest(userId, isOnline)}
            disabled={state.isSubmitting}
            className="flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {strings.psychology.finishTest}
          </button>
        )}
      </div>
    </div>
  );
};
