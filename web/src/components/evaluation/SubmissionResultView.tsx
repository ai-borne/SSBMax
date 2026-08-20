import { FC } from 'react';
import { strings } from '../../constants/strings';
import { useSubmissionResultViewModel } from '../../viewmodels/useSubmissionResultViewModel';
import { OLQScoreCard, OLQScoreItem } from './OLQScoreCard';

export interface SubmissionResultViewProps {
  submissionId: string;
  /** A `FirestorePaths.*_RESULTS` constant, e.g. `psych_results`/`ppdt_results`/`gto_results`. */
  resultCollection: string;
}

/**
 * Generic per-submission result screen (Phase 11d, Web SSB Test Flow Parity plan) --
 * one component covers PPDT/TAT/WAT/SRT/SD/GTO rather than seven near-identical ones,
 * since their result documents all share the same `olqScores`/`overallScore`/
 * `strengths`/`weaknesses`/`recommendations` shape. Reuses the already-built
 * `OLQScoreCard` rather than inventing new score-display markup.
 */
export const SubmissionResultView: FC<SubmissionResultViewProps> = ({ submissionId, resultCollection }) => {
  const { status, result, error } = useSubmissionResultViewModel({ submissionId, resultCollection });
  const t = strings.testRunner.result;

  if (error) {
    return <div data-testid="result-not-found" className="p-6 text-center text-red-400">{t.notFound}</div>;
  }
  if (status === 'FAILED') {
    return <div data-testid="result-failed" className="p-6 text-center text-red-400">{t.failed}</div>;
  }
  if (status !== 'COMPLETED' || !result) {
    return (
      <div data-testid="result-analyzing" className="p-6 text-center text-slate-400 animate-pulse">
        {t.analyzing}
      </div>
    );
  }

  const olqItems: OLQScoreItem[] = Object.entries(result.olqScores || {}).map(([olq, score]) => ({
    olq,
    score: score.score,
    reasoning: score.reasoning
  }));

  return (
    <div data-testid="submission-result-view">
      <OLQScoreCard
        olqScores={olqItems}
        overallConfidence={result.aiConfidence}
        keyInsights={result.strengths}
        suggestedFollowUp={result.recommendations?.[0]}
      />
    </div>
  );
};

export default SubmissionResultView;
