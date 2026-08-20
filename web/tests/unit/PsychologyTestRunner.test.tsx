import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PsychologyTestRunner } from '../../src/components/testRunners/PsychologyTestRunner';
import { strings } from '../../src/constants/strings';

describe('PsychologyTestRunner Component Unit Tests', () => {
  let mockViewModel: any;

  beforeEach(() => {
    mockViewModel = {
      getState: vi.fn().mockReturnValue({
        testType: 'WAT',
        slides: [
          {
            id: 'wat-1',
            index: 0,
            content: 'LEADERSHIP',
            durationSeconds: 15
          }
        ],
        currentSlideIndex: 0,
        responses: {},
        isLoading: false,
        isSubmitting: false,
        isCompleted: false,
        error: null
      }),
      subscribe: vi.fn().mockReturnValue(() => {}),
      loadTestContent: vi.fn(),
      updateResponse: vi.fn(),
      nextSlide: vi.fn().mockReturnValue(false),
      submitTest: vi.fn()
    };
  });

  it('should render WAT prompt and response textarea', () => {
    render(<PsychologyTestRunner viewModel={mockViewModel} userId="user-1" isOnline={true} />);

    expect(screen.getByText('LEADERSHIP')).toBeInTheDocument();
    expect(screen.getByText(strings.psychology.watTitle)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(strings.psychology.writeResponsePlaceholder)).toBeInTheDocument();
  });

  it('should update candidate response on typing', () => {
    render(<PsychologyTestRunner viewModel={mockViewModel} userId="user-1" isOnline={true} />);

    const textarea = screen.getByPlaceholderText(strings.psychology.writeResponsePlaceholder);
    fireEvent.change(textarea, { target: { value: 'Leadership inspires teamwork.' } });

    expect(mockViewModel.updateResponse).toHaveBeenCalledWith('wat-1', 'Leadership inspires teamwork.');
  });

  it('should render Return to SSB Tests button on completion screen and trigger onExitTest when clicked', () => {
    mockViewModel.getState.mockReturnValue({
      testType: 'WAT',
      slides: [],
      currentSlideIndex: 0,
      responses: {},
      isLoading: false,
      isSubmitting: false,
      isCompleted: true,
      error: null
    });
    const onExitTestSpy = vi.fn();

    render(<PsychologyTestRunner viewModel={mockViewModel} userId="user-1" onExitTest={onExitTestSpy} />);

    expect(screen.getByText(strings.psychology.completedTitle)).toBeInTheDocument();
    const returnBtn = screen.getByTestId('return-to-tests-button');
    expect(returnBtn).toBeInTheDocument();

    fireEvent.click(returnBtn);
    expect(onExitTestSpy).toHaveBeenCalled();
  });
});
