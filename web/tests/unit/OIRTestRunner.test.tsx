import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OIRTestRunner } from '../../src/components/testRunners/OIRTestRunner';
import { strings } from '../../src/constants/strings';

describe('OIRTestRunner Component Unit Tests', () => {
  let mockViewModel: any;

  beforeEach(() => {
    mockViewModel = {
      getState: vi.fn().mockReturnValue({
        questions: [
          {
            id: 'q1',
            questionNumber: 1,
            questionText: 'What is 2 + 2?',
            options: ['3', '4', '5', '6'],
            type: 'VERBAL'
          }
        ],
        currentIndex: 0,
        answers: {},
        isLoading: false,
        isSubmitting: false,
        isCompleted: false,
        error: null,
        result: null,
        timeRemainingSeconds: 1800
      }),
      subscribe: vi.fn().mockReturnValue(() => {}),
      loadQuestions: vi.fn(),
      selectOption: vi.fn(),
      nextQuestion: vi.fn(),
      previousQuestion: vi.fn(),
      submitTest: vi.fn()
    };
  });

  it('should render question text and option choices', () => {
    render(<OIRTestRunner viewModel={mockViewModel} userId="user-1" isOnline={true} />);

    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(strings.oir.title)).toBeInTheDocument();
  });

  it('should handle option click and call selectOption', () => {
    render(<OIRTestRunner viewModel={mockViewModel} userId="user-1" isOnline={true} />);

    const optionBtn = screen.getByText('4');
    fireEvent.click(optionBtn);

    expect(mockViewModel.selectOption).toHaveBeenCalledWith('q1', 1);
  });

  it('should render Return to SSB Tests button on completion screen and trigger onExitTest when clicked', () => {
    mockViewModel.getState.mockReturnValue({
      questions: [],
      currentIndex: 0,
      answers: {},
      isLoading: false,
      isSubmitting: false,
      isCompleted: true,
      error: null,
      result: { score: 45, totalQuestions: 50, oirRating: 1 },
      timeRemainingSeconds: 0
    });
    const onExitTestSpy = vi.fn();

    render(<OIRTestRunner viewModel={mockViewModel} userId="user-1" onExitTest={onExitTestSpy} />);

    expect(screen.getByText(strings.oir.completedTitle)).toBeInTheDocument();
    const returnBtn = screen.getByTestId('return-to-tests-button');
    expect(returnBtn).toBeInTheDocument();

    fireEvent.click(returnBtn);
    expect(onExitTestSpy).toHaveBeenCalled();
  });
});
