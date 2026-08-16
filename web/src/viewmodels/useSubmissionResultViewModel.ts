import { useEffect, useState } from 'react';
import { SubmissionRepository, SubmissionAnalysisStatus } from '../repositories/SubmissionRepository';

export interface OLQResultData {
  olqScores: Record<string, { score: number; confidence?: number; reasoning?: string }>;
  overallScore?: number;
  overallRating?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  aiConfidence?: number;
}

export type SubmissionResultStatus = 'LOADING' | SubmissionAnalysisStatus;

export interface UseSubmissionResultOptions {
  submissionId: string;
  resultCollection: string;
  pollIntervalMs?: number;
  repository?: SubmissionRepository;
}

export interface SubmissionResultState {
  status: SubmissionResultStatus;
  result: OLQResultData | null;
  error: string | null;
}

/**
 * Polls `submissions/{id}`'s analysis status (Phase 11d, Web SSB Test Flow Parity
 * plan) until it reaches `COMPLETED`/`FAILED`, then reads the matching result
 * collection once -- mirrors `PPDTSubmissionResultViewModel`'s KMP polling pattern.
 * One generic hook covers every gradeable test type rather than seven near-identical
 * ones, since `psych_results`/`ppdt_results`/`gto_results` all share this shape.
 */
export function useSubmissionResultViewModel({
  submissionId,
  resultCollection,
  pollIntervalMs = 3000,
  repository: injectedRepository
}: UseSubmissionResultOptions): SubmissionResultState {
  const [state, setState] = useState<SubmissionResultState>({ status: 'LOADING', result: null, error: null });

  // A `= new SubmissionRepository()` default parameter constructs a fresh instance on
  // every call, not once -- with `repository` in the effect's dependency array below,
  // that identity churn caused an infinite render loop (every caller that doesn't pass
  // its own repository, e.g. `SubmissionResultView`, hit the default on every render).
  // `useState(() => ...)` lazy-inits exactly once per component instance.
  const [defaultRepository] = useState(() => new SubmissionRepository());
  const repository = injectedRepository ?? defaultRepository;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const statusResult = await repository.getSubmissionStatus(submissionId);
      if (cancelled) return;

      if (!statusResult) {
        setState({ status: 'LOADING', result: null, error: 'not-found' });
        return;
      }

      if (statusResult.status === 'COMPLETED') {
        const data = await repository.getResult<OLQResultData>(resultCollection, submissionId);
        if (!cancelled) setState({ status: 'COMPLETED', result: data, error: null });
        return;
      }

      if (statusResult.status === 'FAILED') {
        if (!cancelled) setState({ status: 'FAILED', result: null, error: null });
        return;
      }

      setState({ status: statusResult.status, result: null, error: null });
      timer = setTimeout(poll, pollIntervalMs);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [submissionId, resultCollection, pollIntervalMs, repository]);

  return state;
}
