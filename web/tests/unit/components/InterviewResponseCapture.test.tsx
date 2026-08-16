import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InterviewResponseCapture } from '../../../src/components/testRunners/InterviewResponseCapture';

function mockService(overrides: Partial<Record<string, any>> = {}) {
  return {
    submitInterviewResponse: vi.fn().mockResolvedValue({ success: true, responseId: 'resp-1' }),
    evaluateInterviewResponse: vi.fn().mockResolvedValue({ success: true }),
    ...overrides
  } as any;
}

describe('InterviewResponseCapture', () => {
  it('shows the unavailable notice and no submit button when no sessionId is supplied (no session-creation flow exists yet)', () => {
    render(<InterviewResponseCapture questionId="q1" submissionService={mockService()} />);
    expect(screen.getByTestId('interview-session-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('interview-submit-button')).not.toBeInTheDocument();
    // Capture itself still works even without a session (groundwork requirement).
    fireEvent.change(screen.getByTestId('interview-response-textarea'), { target: { value: 'draft answer' } });
    expect(screen.getByTestId('interview-response-textarea')).toHaveValue('draft answer');
  });

  it('submits and triggers evaluation when a sessionId is present', async () => {
    const service = mockService();
    render(<InterviewResponseCapture sessionId="sess1" questionId="q1" submissionService={service} />);

    fireEvent.change(screen.getByTestId('interview-response-textarea'), { target: { value: 'my answer' } });
    fireEvent.click(screen.getByTestId('interview-submit-button'));

    await waitFor(() => expect(screen.getByTestId('interview-submit-success')).toBeInTheDocument());
    expect(service.submitInterviewResponse).toHaveBeenCalledWith({
      sessionId: 'sess1',
      questionId: 'q1',
      responseText: 'my answer',
      responseMode: 'TEXT_BASED'
    });
    expect(service.evaluateInterviewResponse).toHaveBeenCalledWith({ responseId: 'resp-1', sessionId: 'sess1' });
  });

  it('shows an error message when submission fails', async () => {
    const service = mockService({ submitInterviewResponse: vi.fn().mockRejectedValue(new Error('network down')) });
    render(<InterviewResponseCapture sessionId="sess1" questionId="q1" submissionService={service} />);

    fireEvent.change(screen.getByTestId('interview-response-textarea'), { target: { value: 'answer' } });
    fireEvent.click(screen.getByTestId('interview-submit-button'));

    await waitFor(() => expect(screen.getByTestId('interview-submit-error')).toBeInTheDocument());
    expect(screen.getByTestId('interview-submit-error').textContent).toMatch(/network down/);
  });
});
