import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, type Mocked } from 'vitest';
import { InterviewResponseCapture } from '../../../src/components/testRunners/InterviewResponseCapture';
import { SubmissionService } from '../../../src/services/SubmissionService';
import { EligibilityService } from '../../../src/services/EligibilityService';

function mockService(overrides: Partial<Record<keyof SubmissionService, unknown>> = {}): Mocked<SubmissionService> {
  return {
    submitInterviewResponse: vi.fn().mockResolvedValue({ success: true, responseId: 'resp-1' }),
    evaluateInterviewResponse: vi.fn().mockResolvedValue({ success: true }),
    ...overrides
  } as unknown as Mocked<SubmissionService>;
}

function mockEligibility(overrides: Partial<Record<keyof EligibilityService, unknown>> = {}): Mocked<EligibilityService> {
  return {
    recordTestUsage: vi.fn().mockResolvedValue({ success: true, alreadyRecorded: false, used: 1, limit: 3 }),
    ...overrides
  } as unknown as Mocked<EligibilityService>;
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

  it('records usage before triggering evaluation when a sessionId is present', async () => {
    const service = mockService();
    const eligibility = mockEligibility();
    const callOrder: string[] = [];
    eligibility.recordTestUsage.mockImplementation(async () => {
      callOrder.push('recordTestUsage');
      return { success: true, alreadyRecorded: false, used: 1, limit: 3 };
    });
    service.evaluateInterviewResponse.mockImplementation(async () => {
      callOrder.push('evaluateInterviewResponse');
      return { success: true };
    });
    render(
      <InterviewResponseCapture
        sessionId="sess1"
        questionId="q1"
        submissionService={service}
        eligibilityService={eligibility}
      />
    );

    fireEvent.change(screen.getByTestId('interview-response-textarea'), { target: { value: 'my answer' } });
    fireEvent.click(screen.getByTestId('interview-submit-button'));

    await waitFor(() => expect(screen.getByTestId('interview-submit-success')).toBeInTheDocument());
    expect(service.submitInterviewResponse).toHaveBeenCalledWith({
      sessionId: 'sess1',
      questionId: 'q1',
      responseText: 'my answer',
      responseMode: 'TEXT_BASED'
    });
    expect(eligibility.recordTestUsage).toHaveBeenCalledWith('IO', 'resp-1');
    expect(service.evaluateInterviewResponse).toHaveBeenCalledWith({ responseId: 'resp-1', sessionId: 'sess1' });
    expect(callOrder).toEqual(['recordTestUsage', 'evaluateInterviewResponse']);
  });

  it('a recordTestUsage rejection (quota exhausted) blocks evaluateInterviewResponse and surfaces as the submit error', async () => {
    const service = mockService();
    const eligibility = mockEligibility({
      recordTestUsage: vi.fn().mockRejectedValue(new Error('Monthly quota reached for INTERVIEW (1/1)'))
    });
    render(
      <InterviewResponseCapture
        sessionId="sess1"
        questionId="q1"
        submissionService={service}
        eligibilityService={eligibility}
      />
    );

    fireEvent.change(screen.getByTestId('interview-response-textarea'), { target: { value: 'my answer' } });
    fireEvent.click(screen.getByTestId('interview-submit-button'));

    await waitFor(() => expect(screen.getByTestId('interview-submit-error')).toBeInTheDocument());
    expect(screen.getByTestId('interview-submit-error').textContent).toMatch(/quota reached/);
    expect(service.evaluateInterviewResponse).not.toHaveBeenCalled();
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
