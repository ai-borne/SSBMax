import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubmissionResultViewModel } from '../../src/viewmodels/useSubmissionResultViewModel';
import type { SubmissionRepository } from '../../src/repositories/SubmissionRepository';

function mockRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getSubmissionStatus: vi.fn(),
    getResult: vi.fn(),
    ...overrides
  } as unknown as SubmissionRepository;
}

describe('useSubmissionResultViewModel', () => {
  it('polls until COMPLETED, then reads the result collection exactly once', async () => {
    const repository = mockRepository({
      getSubmissionStatus: vi
        .fn()
        .mockResolvedValueOnce({ status: 'ANALYZING' })
        .mockResolvedValueOnce({ status: 'COMPLETED' }),
      getResult: vi.fn().mockResolvedValue({ olqScores: { COURAGE: { score: 5 } }, overallScore: 5 })
    });

    const { result } = renderHook(() =>
      useSubmissionResultViewModel({ submissionId: 'sub1', resultCollection: 'psych_results', pollIntervalMs: 1, repository })
    );

    await waitFor(() => expect(result.current.status).toBe('COMPLETED'));
    expect(result.current.result?.overallScore).toBe(5);
    expect(repository.getResult).toHaveBeenCalledTimes(1);
    expect(repository.getResult).toHaveBeenCalledWith('psych_results', 'sub1');
  });

  it('stops polling and reports FAILED without reading the result collection', async () => {
    const repository = mockRepository({
      getSubmissionStatus: vi.fn().mockResolvedValue({ status: 'FAILED' })
    });

    const { result } = renderHook(() =>
      useSubmissionResultViewModel({ submissionId: 'sub1', resultCollection: 'psych_results', pollIntervalMs: 1, repository })
    );

    await waitFor(() => expect(result.current.status).toBe('FAILED'));
    expect(repository.getResult).not.toHaveBeenCalled();
  });

  it('reports an error when the submission cannot be found', async () => {
    const repository = mockRepository({ getSubmissionStatus: vi.fn().mockResolvedValue(null) });

    const { result } = renderHook(() =>
      useSubmissionResultViewModel({ submissionId: 'missing', resultCollection: 'psych_results', repository })
    );

    await waitFor(() => expect(result.current.error).toBe('not-found'));
  });
});
