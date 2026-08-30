import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { aggregateOLQScores, computeOverallAverage, useOLQDashboardViewModel } from '../../src/viewmodels/useOLQDashboardViewModel';
import { OLQResultData } from '../../src/viewmodels/useSubmissionResultViewModel';
import type { SubmissionRepository } from '../../src/repositories/SubmissionRepository';

describe('aggregateOLQScores', () => {
  it('averages the same OLQ across multiple results', () => {
    const results: OLQResultData[] = [
      { olqScores: { COURAGE: { score: 6 }, STAMINA: { score: 4 } } },
      { olqScores: { COURAGE: { score: 8 } } }
    ];
    const scores = aggregateOLQScores(results);
    expect(scores.find((s) => s.olq === 'COURAGE')?.score).toBe(7);
    expect(scores.find((s) => s.olq === 'STAMINA')?.score).toBe(4);
  });

  it('returns an empty array for no results', () => {
    expect(aggregateOLQScores([])).toEqual([]);
  });
});

describe('computeOverallAverage', () => {
  it('averages each result overallScore, ignoring results without one', () => {
    const results: OLQResultData[] = [{ olqScores: {}, overallScore: 6 }, { olqScores: {}, overallScore: 8 }, { olqScores: {} }];
    expect(computeOverallAverage(results)).toBe(7);
  });

  it('returns null when no result has an overallScore', () => {
    expect(computeOverallAverage([{ olqScores: {} }])).toBeNull();
  });
});

describe('useOLQDashboardViewModel', () => {
  it('returns empty state without fetching when there is no signed-in user', () => {
    const repository = { getLatestResultByType: vi.fn() } as unknown as SubmissionRepository;
    const { result } = renderHook(() => useOLQDashboardViewModel(undefined, repository));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.completedTestsCount).toBe(0);
    expect(repository.getLatestResultByType).not.toHaveBeenCalled();
  });

  it('isolates one source failing/missing from the rest -- a broken type degrades to "not attempted"', async () => {
    const repository = {
      getLatestResultByType: vi
        .fn()
        .mockResolvedValueOnce({ olqScores: { COURAGE: { score: 6 } }, overallScore: 6, strengths: ['Courage (6)'] }) // PPDT
        .mockResolvedValue(null) // every other source
    } as unknown as SubmissionRepository;

    const { result } = renderHook(() => useOLQDashboardViewModel('user1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.completedTestsCount).toBe(1);
    expect(result.current.olqScores).toEqual([{ olq: 'COURAGE', score: 6 }]);
    expect(result.current.dossier?.candidateId).toBe('user1');
  });

  it('leaves dossier null when nothing has been completed yet', async () => {
    const repository = { getLatestResultByType: vi.fn().mockResolvedValue(null) } as unknown as SubmissionRepository;
    const { result } = renderHook(() => useOLQDashboardViewModel('user1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.dossier).toBeNull();
    expect(result.current.completedTestsCount).toBe(0);
  });
});
