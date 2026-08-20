import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TestRunnerLayout } from '../../../src/components/practice/runner/TestRunnerLayout';

describe('TestRunnerLayout Component', () => {
  const defaultProps = {
    testTitle: 'OIR Test Simulator',
    totalQuestions: 50,
    currentIndex: 0,
    timeLeftSeconds: 1800,
    questionText: 'Which figure is odd one out?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    selectedOption: 'Option A',
    onPrevQuestion: vi.fn(),
    onNextQuestion: vi.fn(),
    onSelectQuestion: vi.fn(),
    onToggleFlag: vi.fn(),
    onExitTest: vi.fn(),
    onSubmitTest: vi.fn()
  };

  it('renders test runner header, stimulus, response input, and bottom bar', () => {
    render(<TestRunnerLayout {...defaultProps} />);

    expect(screen.getByTestId('test-runner-layout')).toBeInTheDocument();
    expect(screen.getByTestId('test-runner-header')).toBeInTheDocument();
    expect(screen.getByTestId('stimulus-view')).toBeInTheDocument();
    expect(screen.getByTestId('response-input-view')).toBeInTheDocument();
    expect(screen.getByTestId('test-runner-bottom-bar')).toBeInTheDocument();
    expect(screen.getByText('OIR Test Simulator')).toBeInTheDocument();
  });

  it('opens question grid drawer when grid toggle button is clicked', () => {
    render(<TestRunnerLayout {...defaultProps} />);

    const gridToggle = screen.getByTestId('runner-grid-toggle-button');
    fireEvent.click(gridToggle);

    expect(screen.getByTestId('question-grid-drawer')).toBeInTheDocument();

    const closeBtn = screen.getByTestId('close-drawer-button');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('question-grid-drawer')).not.toBeInTheDocument();
  });

  it('triggers navigation callbacks when prev/next buttons are clicked', () => {
    render(<TestRunnerLayout {...defaultProps} currentIndex={1} />);

    fireEvent.click(screen.getByTestId('runner-prev-button'));
    expect(defaultProps.onPrevQuestion).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('runner-next-button'));
    expect(defaultProps.onNextQuestion).toHaveBeenCalled();
  });

  it('triggers auto-submit when timer reaches 0', () => {
    const handleSubmit = vi.fn();
    render(<TestRunnerLayout {...defaultProps} timeLeftSeconds={0} onSubmitTest={handleSubmit} />);

    expect(handleSubmit).toHaveBeenCalled();
  });
});
