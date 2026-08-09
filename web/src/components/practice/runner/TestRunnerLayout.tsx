import { FC, useState, useEffect } from 'react';
import { TestRunnerHeader } from './TestRunnerHeader';
import { TestRunnerBottomBar } from './TestRunnerBottomBar';
import { StimulusView } from './StimulusView';
import { ResponseInputView } from './ResponseInputView';
import { TestQuestionGridDrawer, QuestionStatus } from './TestQuestionGridDrawer';

export interface TestRunnerLayoutProps {
  testTitle: string;
  totalQuestions: number;
  currentIndex: number;
  timeLeftSeconds: number;
  questionText: string;
  stimulusType?: 'VERBAL' | 'NON_VERBAL' | 'IMAGE' | 'WORD';
  imageUrl?: string;
  options?: string[];
  selectedOption?: string;
  presetChips?: string[];
  textResponse?: string;
  questionStatuses?: QuestionStatus[];
  isFlagged?: boolean;
  onSelectOption?: (option: string) => void;
  onTextChange?: (text: string) => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onSelectQuestion: (index: number) => void;
  onToggleFlag: () => void;
  onExitTest: () => void;
  onSubmitTest: () => void;
}

export const TestRunnerLayout: FC<TestRunnerLayoutProps> = ({
  testTitle,
  totalQuestions,
  currentIndex,
  timeLeftSeconds,
  questionText,
  stimulusType = 'VERBAL',
  imageUrl,
  options = [],
  selectedOption = '',
  presetChips = [],
  textResponse = '',
  questionStatuses = [],
  isFlagged = false,
  onSelectOption,
  onTextChange,
  onPrevQuestion,
  onNextQuestion,
  onSelectQuestion,
  onToggleFlag,
  onExitTest,
  onSubmitTest
}) => {
  const [gridOpen, setGridOpen] = useState(false);

  // BeforeUnload Guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Fail-Safe Auto-Submit on Timer Expiration
  useEffect(() => {
    if (timeLeftSeconds === 0) {
      onSubmitTest();
    }
  }, [timeLeftSeconds, onSubmitTest]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans" data-testid="test-runner-layout">
      <TestRunnerHeader
        testTitle={testTitle}
        timeLeftSeconds={timeLeftSeconds}
        onExitClick={onExitTest}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
        <StimulusView
          questionNumber={currentIndex + 1}
          questionText={questionText}
          imageUrl={imageUrl}
          stimulusType={stimulusType}
        />
        <ResponseInputView
          options={options}
          selectedOption={selectedOption}
          presetChips={presetChips}
          textResponse={textResponse}
          onSelectOption={onSelectOption}
          onTextChange={onTextChange}
        />
      </main>

      <TestRunnerBottomBar
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        isFlagged={isFlagged}
        onPrev={onPrevQuestion}
        onNext={onNextQuestion}
        onToggleGrid={() => setGridOpen(true)}
        onToggleFlag={onToggleFlag}
        onSubmit={onSubmitTest}
      />

      <TestQuestionGridDrawer
        isOpen={gridOpen}
        totalQuestions={totalQuestions}
        currentIndex={currentIndex}
        questionStatuses={questionStatuses}
        onSelectQuestion={onSelectQuestion}
        onClose={() => setGridOpen(false)}
      />
    </div>
  );
};

export default TestRunnerLayout;
