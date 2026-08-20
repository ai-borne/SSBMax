import { useEffect, useState } from 'react';
import { SubmissionRepository } from '../repositories/SubmissionRepository';

export interface OIRResultData {
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  percentageScore: number;
  oirRating: number;
  timeTakenSeconds: number;
}

interface OIRSubmissionData {
  testResult?: OIRResultData;
}

export type OIRSubmissionResultStatus = 'LOADING' | 'COMPLETED' | 'NOT_FOUND';

export interface UseOIRSubmissionResultOptions {
  submissionId: string;
  repository?: SubmissionRepository;
}

export interface OIRSubmissionResultState {
  status: OIRSubmissionResultStatus;
  result: OIRResultData | null;
}

/**
 * One-shot read (no polling) of `submissions/{id}`'s embedded `testResult` -- unlike
 * `useSubmissionResultViewModel`'s AI-graded siblings, OIR's score is known synchronously at
 * submit time (`functions/src/submissions.js::createOIRSubmission`), so there is no
 * `PENDING_ANALYSIS` -> `COMPLETED` transition to poll for; by the time a user can tap a
 * notification for it, the doc has long since finished writing.
 */
export function useOIRSubmissionResultViewModel({
  submissionId,
  repository: injectedRepository
}: UseOIRSubmissionResultOptions): OIRSubmissionResultState {
  const [state, setState] = useState<OIRSubmissionResultState>({ status: 'LOADING', result: null });

  // Same lazy-init rationale as useSubmissionResultViewModel's defaultRepository: a bare
  // `= new SubmissionRepository()` default re-constructs every render, churning this effect's
  // dependency array.
  const [defaultRepository] = useState(() => new SubmissionRepository());
  const repository = injectedRepository ?? defaultRepository;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const data = await repository.getSubmissionData<OIRSubmissionData>(submissionId);
      if (cancelled) return;
      if (!data?.testResult) {
        setState({ status: 'NOT_FOUND', result: null });
        return;
      }
      setState({ status: 'COMPLETED', result: data.testResult });
    })();

    return () => {
      cancelled = true;
    };
  }, [submissionId, repository]);

  return state;
}
