import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOIRSubmissionResultViewModel } from '../../src/viewmodels/useOIRSubmissionResultViewModel';

function mockRepository(overrides: Partial<Record<string, any>> = {}) {
  return { getSubmissionData: vi.fn(), ...overrides } as any;
}

describe('useOIRSubmissionResultViewModel', () => {
  it('reads the embedded testResult in one shot, no polling', async () => {
    const repository = mockRepository({
      getSubmissionData: vi.fn().mockResolvedValue({
        testResult: { totalQuestions: 50, correctAnswers: 40, percentageScore: 80, oirRating: 1 }
      })
    });

    const { result } = renderHook(() => useOIRSubmissionResultViewModel({ submissionId: 'sub1', repository }));

    await waitFor(() => expect(result.current.status).toBe('COMPLETED'));
    expect(result.current.result?.oirRating).toBe(1);
    expect(repository.getSubmissionData).toHaveBeenCalledTimes(1);
    expect(repository.getSubmissionData).toHaveBeenCalledWith('sub1');
  });

  it('reports NOT_FOUND when the submission has no testResult', async () => {
    const repository = mockRepository({ getSubmissionData: vi.fn().mockResolvedValue(null) });

    const { result } = renderHook(() => useOIRSubmissionResultViewModel({ submissionId: 'missing', repository }));

    await waitFor(() => expect(result.current.status).toBe('NOT_FOUND'));
    expect(result.current.result).toBeNull();
  });
});
