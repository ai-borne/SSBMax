import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubmissionResultView } from '../../../src/components/evaluation/SubmissionResultView';
import { SubmissionRepository } from '../../../src/repositories/SubmissionRepository';

vi.mock('../../../src/repositories/SubmissionRepository');

describe('SubmissionResultView', () => {
  it('shows the analyzing state while status is not yet COMPLETED', async () => {
    vi.mocked(SubmissionRepository).mockImplementation(
      () =>
        ({
          getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'ANALYZING' }),
          getResult: vi.fn()
        }) as unknown as SubmissionRepository
    );

    render(<SubmissionResultView submissionId="sub1" resultCollection="psych_results" />);
    await waitFor(() => expect(screen.getByTestId('result-analyzing')).toBeInTheDocument());
  });

  it('renders OLQScoreCard data once the result is COMPLETED', async () => {
    vi.mocked(SubmissionRepository).mockImplementation(
      () =>
        ({
          getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
          getResult: vi.fn().mockResolvedValue({
            olqScores: { COURAGE: { score: 5, reasoning: 'Solid' } },
            overallScore: 5,
            strengths: ['Courage (5)'],
            recommendations: ['Keep practicing'],
            aiConfidence: 80
          })
        }) as unknown as SubmissionRepository
    );

    render(<SubmissionResultView submissionId="sub1" resultCollection="psych_results" />);
    await waitFor(() => expect(screen.getByTestId('submission-result-view')).toBeInTheDocument());
  });

  it('shows the failed state when analysis status is FAILED', async () => {
    vi.mocked(SubmissionRepository).mockImplementation(
      () =>
        ({
          getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'FAILED' }),
          getResult: vi.fn()
        }) as unknown as SubmissionRepository
    );

    render(<SubmissionResultView submissionId="sub1" resultCollection="psych_results" />);
    await waitFor(() => expect(screen.getByTestId('result-failed')).toBeInTheDocument());
  });

  it('shows the not-found state when the submission does not exist', async () => {
    vi.mocked(SubmissionRepository).mockImplementation(
      () =>
        ({
          getSubmissionStatus: vi.fn().mockResolvedValue(null),
          getResult: vi.fn()
        }) as unknown as SubmissionRepository
    );

    render(<SubmissionResultView submissionId="missing" resultCollection="psych_results" />);
    await waitFor(() => expect(screen.getByTestId('result-not-found')).toBeInTheDocument());
  });
});
