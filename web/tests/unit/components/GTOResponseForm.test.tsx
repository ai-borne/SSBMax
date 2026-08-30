import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, type Mocked } from 'vitest';
import { GTOResponseForm } from '../../../src/components/testRunners/GTOResponseForm';
import { SubmissionRepository } from '../../../src/repositories/SubmissionRepository';
import { SubmissionService } from '../../../src/services/SubmissionService';
import { EligibilityService } from '../../../src/services/EligibilityService';

vi.mock('../../../src/repositories/SubmissionRepository');

function mockService(overrides: Partial<Record<keyof SubmissionService, unknown>> = {}): Mocked<SubmissionService> {
  return {
    submitGTOTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'gto-sub-1' }),
    evaluateGTO: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
    ...overrides
  } as unknown as Mocked<SubmissionService>;
}

function mockEligibility(overrides: Partial<Record<keyof EligibilityService, unknown>> = {}): Mocked<EligibilityService> {
  return {
    recordTestUsage: vi.fn().mockResolvedValue({ success: true, alreadyRecorded: false, used: 1, limit: 3 }),
    ...overrides
  } as unknown as Mocked<EligibilityService>;
}

describe('GTOResponseForm', () => {
  it('sends GD-shaped fields (topic/response/charCount), records usage before evaluateGTO -- GD is server-evaluable today', async () => {
    const service = mockService();
    const eligibility = mockEligibility();
    const callOrder: string[] = [];
    eligibility.recordTestUsage.mockImplementation(async () => {
      callOrder.push('recordTestUsage');
      return { success: true, alreadyRecorded: false, used: 1, limit: 3 };
    });
    service.evaluateGTO.mockImplementation(async () => {
      callOrder.push('evaluateGTO');
      return { success: true, status: 'PENDING_ANALYSIS' };
    });
    render(
      <GTOResponseForm
        gtoType="GTO_GD"
        topic="Leadership under pressure"
        submissionService={service}
        eligibilityService={eligibility}
      />
    );

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My response text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-success')).toBeInTheDocument());
    expect(service.submitGTOTest).toHaveBeenCalledWith({
      gtoType: 'GTO_GD',
      topic: 'Leadership under pressure',
      response: 'My response text',
      charCount: 'My response text'.length
    });
    expect(eligibility.recordTestUsage).toHaveBeenCalledWith('GTO_GD', 'gto-sub-1');
    expect(service.evaluateGTO).toHaveBeenCalledWith({ submissionId: 'gto-sub-1' });
    expect(callOrder).toEqual(['recordTestUsage', 'evaluateGTO']);
  });

  it('a recordTestUsage rejection (quota exhausted) blocks evaluateGTO and surfaces as the submit error -- this is the live bug this test guards against regressing', async () => {
    const service = mockService();
    const eligibility = mockEligibility({
      recordTestUsage: vi.fn().mockRejectedValue(new Error('Monthly quota reached for GTO (3/3)'))
    });
    render(
      <GTOResponseForm gtoType="GTO_GD" topic="Topic" submissionService={service} eligibilityService={eligibility} />
    );

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-error')).toBeInTheDocument());
    expect(screen.getByTestId('gto-submit-error').textContent).toMatch(/quota reached/);
    expect(service.evaluateGTO).not.toHaveBeenCalled();
  });

  it('sends GPE-shaped fields (scenario/plan/characterCount), not GD field names', async () => {
    const service = mockService();
    render(
      <GTOResponseForm
        gtoType="GTO_GPE"
        topic="Flood rescue scenario"
        submissionService={service}
        eligibilityService={mockEligibility()}
      />
    );

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
    render(
      <GTOResponseForm
        gtoType="GTO_LECTURETTE"
        topic="Space Exploration"
        submissionService={service}
        eligibilityService={mockEligibility()}
      />
    );

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
      () => ({ getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'ANALYZING' }), getResult: vi.fn() }) as unknown as SubmissionRepository
    );
    const service = mockService();
    render(
      <GTOResponseForm
        gtoType="GTO_GD"
        topic="Leadership under pressure"
        submissionService={service}
        eligibilityService={mockEligibility()}
      />
    );

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My response text' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('result-analyzing')).toBeInTheDocument());
  });

  it('does NOT trigger evaluateGTO or recordTestUsage for a type gtoEvaluate.js does not support, and shows the groundwork notice instead', async () => {
    const service = mockService();
    const eligibility = mockEligibility();
    render(
      <GTOResponseForm gtoType="GTO_PGT" topic="Obstacle course" submissionService={service} eligibilityService={eligibility} />
    );

    fireEvent.change(screen.getByTestId('gto-response-textarea'), { target: { value: 'My notes' } });
    fireEvent.click(screen.getByTestId('gto-submit-button'));

    await waitFor(() => expect(screen.getByTestId('gto-submit-success')).toBeInTheDocument());
    expect(service.submitGTOTest).toHaveBeenCalledWith({ gtoType: 'GTO_PGT', notes: 'My notes' });
    expect(eligibility.recordTestUsage).not.toHaveBeenCalled();
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
