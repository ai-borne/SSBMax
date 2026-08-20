import { describe, it, expect, vi } from 'vitest';
import { SubmissionRepository } from '../../src/repositories/SubmissionRepository';
import { getDoc, getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

/**
 * `getSubmissionStatus` must read the *correct* status field per test type -- PPDT/
 * TAT/WAT/SRT/SD nest it under `data.analysisStatus`, GTO stores it top-level as
 * `status` (a documented, not-fixed-here quirk in `gtoEvaluate.js`). A repository that
 * only checked one shape would silently report "no status" for whichever type uses
 * the other, breaking Phase 11d's result-screen polling for that type.
 */
describe('SubmissionRepository', () => {
  const repository = new SubmissionRepository();

  it('reads the nested data.analysisStatus field (PPDT/TAT/WAT/SRT/SD envelope)', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ userId: 'u1', testType: 'WAT', data: { analysisStatus: 'ANALYZING' } })
    } as any);
    expect(await repository.getSubmissionStatus('sub1')).toEqual({ status: 'ANALYZING' });
  });

  it('falls back to the top-level status field (GTO envelope)', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ userId: 'u1', testType: 'GTO_GD', status: 'COMPLETED' })
    } as any);
    expect(await repository.getSubmissionStatus('sub2')).toEqual({ status: 'COMPLETED' });
  });

  it('returns null when the submission does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as any);
    expect(await repository.getSubmissionStatus('missing')).toBeNull();
  });

  it('fails closed to null (not a thrown error) when Firestore read throws', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    expect(await repository.getSubmissionStatus('sub1')).toBeNull();
  });

  it('getResult returns the typed doc data when it exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ overallScore: 6.2 })
    } as any);
    const result = await repository.getResult<{ overallScore: number }>('psych_results', 'sub1');
    expect(result?.overallScore).toBe(6.2);
  });

  it('getResult fails closed to null on a read error', async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));
    expect(await repository.getResult('psych_results', 'sub1')).toBeNull();
  });

  it('getLatestResultByType returns the first (most recent) matching doc', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ overallScore: 7 }) }]
    } as any);
    const result = await repository.getLatestResultByType<{ overallScore: number }>('psych_results', 'user1', 'WAT');
    expect(result?.overallScore).toBe(7);
  });

  it('getLatestResultByType returns null when no result exists for that type -- treated as "not attempted"', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ empty: true, docs: [] } as any);
    expect(await repository.getLatestResultByType('psych_results', 'user1', 'WAT')).toBeNull();
  });

  it('getLatestResultByType fails closed to null on a query error', async () => {
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('offline'));
    expect(await repository.getLatestResultByType('psych_results', 'user1', 'WAT')).toBeNull();
  });
});
