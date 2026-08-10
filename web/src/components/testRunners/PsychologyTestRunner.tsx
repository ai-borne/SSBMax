import React, { useEffect, useState, useCallback } from 'react';
import { PsychologyTestViewModel, PsychologyTestState } from '../../viewmodels/PsychologyTestViewModel';
import { useTestTimer } from '../../hooks/useTestTimer';
import { strings } from '../../constants/strings';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { AntiCheatWarningBanner } from '../common/AntiCheatWarningBanner';
import { Clock, CheckCircle2, ChevronRight, Send, AlertTriangle, FileText, LogOut } from 'lucide-react';

export interface PsychologyTestRunnerProps {
  viewModel: PsychologyTestViewModel;
  userId: string;
  isOnline?: boolean;
  batchId?: string;
  onExitTest?: () => void;
}

export const PsychologyTestRunner: React.FC<PsychologyTestRunnerProps> = ({
  viewModel,
  userId,
  isOnline = true,
  batchId,
  onExitTest
}) => {
  const [state, setState] = useState<PsychologyTestState>(viewModel.getState());
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => {
      setState(viewModel.getState());
    });
    viewModel.loadTestContent(batchId);
    return () => unsubscribe();
  }, [viewModel, batchId]);


  const currentSlide = state.slides[state.currentSlideIndex];

  const handleSlideComplete = useCallback(() => {
    const hasNext = viewModel.nextSlide();
    if (!hasNext) {
      viewModel.submitTest(userId, isOnline);
    }
  }, [viewModel, userId, isOnline]);

  const { formattedTime, reset } = useTestTimer({
    initialSeconds: currentSlide?.durationSeconds || 60,
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
      <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center max-w-lg mx-auto">
        <CheckCircle2 className="w-16 h-16 text-[var(--color-success)] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">{strings.psychology.completedTitle}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">{strings.psychology.completedMessage}</p>
      </div>
    );
  }

  if (!currentSlide) return null;

  const currentResponse = state.responses[currentSlide.id] || '';

  const getTitle = () => {
    switch (state.testType) {
      case 'TAT': return strings.psychology.tatTitle;
      case 'WAT': return strings.psychology.watTitle;
      case 'SRT': return strings.psychology.srtTitle;
      case 'PPDT': return strings.psychology.ppdtTitle;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AntiCheatWarningBanner message={warningMessage} />
      {/* Test Title, Slide Counter & Exit Header */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{getTitle()}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Slide {state.currentSlideIndex + 1} of {state.slides.length}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {!isOnline && (
            <span className="flex items-center text-xs px-2.5 py-1 bg-amber-900/30 text-[var(--color-warning)] border border-amber-800/50 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {strings.psychology.requiresOnline}
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

      {/* Polymorphic Slide Display */}
      <div className="p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        {state.testType === 'TAT' || state.testType === 'PPDT' ? (
          <img
            src={currentSlide.content}
            alt="Psychology Slide Prompt"
            className="max-h-80 rounded-lg border border-[var(--color-border)] object-contain"
          />
        ) : state.testType === 'WAT' ? (
          <div className="text-4xl font-extrabold tracking-widest text-[var(--color-accent)] uppercase py-8">
            {currentSlide.content}
          </div>
        ) : (
          <div className="flex items-start space-x-3 p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)] w-full text-[var(--color-text-primary)]">
            <FileText className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
            <p className="text-base font-medium">{currentSlide.content}</p>
          </div>
        )}
      </div>

      {/* Candidate Response Text Area */}
      <div className="space-y-2">
        <textarea
          value={currentResponse}
          onChange={(e) => viewModel.updateResponse(currentSlide.id, e.target.value)}
          placeholder={strings.psychology.writeResponsePlaceholder}
          rows={5}
          className="w-full p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all text-sm resize-y"
        />
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-end">
        {state.currentSlideIndex < state.slides.length - 1 ? (
          <button
            onClick={() => handleSlideComplete()}
            className="flex items-center px-5 py-2.5 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {strings.psychology.nextSlide}
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        ) : (
          <button
            onClick={() => viewModel.submitTest(userId, isOnline)}
            disabled={state.isSubmitting}
            className="flex items-center px-6 py-2.5 bg-[var(--color-success)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {strings.psychology.finishTest}
          </button>
        )}
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
