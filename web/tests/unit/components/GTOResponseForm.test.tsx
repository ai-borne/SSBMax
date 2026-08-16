import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GTOResponseForm } from '../../../src/components/testRunners/GTOResponseForm';
import { SubmissionRepository } from '../../../src/repositories/SubmissionRepository';

vi.mock('../../../src/repositories/SubmissionRepository');

function mockService(overrides: Partial<Record<string, any>> = {}) {
  return {
    submitGTOTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'gto-sub-1' }),
    evaluateGTO: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
    ...overrides
  } as any;
}

describe('GTOResponseForm', () => {
  it('sends GD-shaped fields (topic/response/charCount) and triggers evaluateGTO -- GD is server-evaluable today', async () => {
    const service = mockService();
    render(<GTOResponseForm gtoType="GTO_GD" topic="Leadership under pressure" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My response text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-success')).toBeInTheDocument());
    expect(service.submitGTOTest).toHaveBeenCalledWith({
      gtoType: 'GTO_GD',
      topic: 'Leadership under pressure',
      response: 'My response text',
      charCount: 'My response text'.length
    });
    expect(service.evaluateGTO).toHaveBeenCalledWith({ submissionId: 'gto-sub-1' });
  });

  it('sends GPE-shaped fields (scenario/plan/characterCount), not GD field names', async () => {
    const service = mockService();
    render(<GTOResponseForm gtoType="GTO_GPE" topic="Flood rescue scenario" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My tactical plan' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(service.submitGTOTest).toHaveBeenCalled());
    expect(service.submitGTOTest).toHaveBeenCalledWith({
      gtoType: 'GTO_GPE',
      scenario: 'Flood rescue scenario',
      plan: 'My tactical plan',
      characterCount: 'My tactical plan'.length
    });
  });

  it('sends Lecturette-shaped fields (selectedTopic/topicChoices/speechTranscript)', async () => {
    const service = mockService();
    render(<GTOResponseForm gtoType="GTO_LECTURETTE" topic="Space Exploration" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My speech' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(service.submitGTOTest).toHaveBeenCalled());
    expect(service.submitGTOTest).toHaveBeenCalledWith({
      gtoType: 'GTO_LECTURETTE',
      selectedTopic: 'Space Exploration',
      topicChoices: ['Space Exploration'],
      speechTranscript: 'My speech',
      charCount: 'My speech'.length
    });
  });

  it('shows the live SubmissionResultView for an evaluable type once submitted, so the user sees their score once analysis completes', async () => {
    vi.mocked(SubmissionRepository).mockImplementation(
      () => ({ getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'ANALYZING' }), getResult: vi.fn() }) as any
    );
    const service = mockService();
    render(<GTOResponseForm gtoType="GTO_GD" topic="Leadership under pressure" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My response text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('result-analyzing')).toBeInTheDocument());
  });

  it('does NOT trigger evaluateGTO for a type gtoEvaluate.js does not support, and shows the groundwork notice instead', async () => {
    const service = mockService();
    render(<GTOResponseForm gtoType="GTO_PGT" topic="Obstacle course" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My notes' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-success')).toBeInTheDocument());
    expect(service.submitGTOTest).toHaveBeenCalledWith({ gtoType: 'GTO_PGT', notes: 'My notes' });
    expect(service.evaluateGTO).not.toHaveBeenCalled();
    expect(screen.getByTestId('gto-submit-success').textContent).toMatch(/not available yet/i);
  });

  it('shows an error message and re-enables the button when submission fails', async () => {
    const service = mockService({ submitGTOTest: vi.fn().mockRejectedValue(new Error('quota exceeded')) });
    render(<GTOResponseForm gtoType="GTO_GD" topic="Topic" submissionService={service} />);

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-error')).toBeInTheDocument());
    expect(screen.getByTestId('gto-submit-error').textContent).toMatch(/quota exceeded/);
    expect(screen.getByTestId('gto-submit-button')).not.toBeDisabled();
  });

  it('disables the submit button until a non-empty response is entered', () => {
    render(<GTOResponseForm gtoType="GTO_GD" topic="Topic" submissionService={mockService()} />);
    expect(screen.getByTestId('gto-submit-button')).toBeDisabled();
  });
});
