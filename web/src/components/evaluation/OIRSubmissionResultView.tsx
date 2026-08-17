import { FC } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useOIRSubmissionResultViewModel } from '../../viewmodels/useOIRSubmissionResultViewModel';

export interface OIRSubmissionResultViewProps {
  submissionId: string;
}

/**
 * Notification-click counterpart to `OIRTestRunner.tsx`'s inline post-submit result card --
 * reuses the same markup/strings so a past OIR result looks identical whether reached live or
 * via the centralized Notification Center. Needed its own component rather than reusing
 * `SubmissionResultView` because OIR's result shape (score/total/percentage/oirRating) isn't
 * OLQ-scored -- `OLQScoreCard` doesn't apply to it at all.
 */
export const OIRSubmissionResultView: FC<OIRSubmissionResultViewProps> = ({ submissionId }) => {
  const { status, result } = useOIRSubmissionResultViewModel({ submissionId });
  const t = strings.oir;

  if (status === 'LOADING') {
    return <div data-testid="oir-result-loading" className="p-6 text-center text-slate-400 animate-pulse">{strings.testRunner.result.analyzing}</div>;
  }
  if (status === 'NOT_FOUND' || !result) {
    return <div data-testid="oir-result-not-found" className="p-6 text-center text-red-400">{strings.testRunner.result.notFound}</div>;
  }

  return (
    <div data-testid="oir-submission-result-view" className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center max-w-lg mx-auto space-y-6 shadow-xl">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div>
        <h2 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">{t.completedTitle}</h2>
      </div>

      <div className="p-5 bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t.scoreLabel}</p>
          <p className="text-3xl font-extrabold text-[var(--color-accent)] mt-1">
            {result.correctAnswers} <span className="text-sm font-normal text-[var(--color-text-muted)]">/ {result.totalQuestions}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t.ratingLabel}</p>
          <p className="text-3xl font-extrabold text-emerald-500 mt-1">OIR-{result.oirRating}</p>
        </div>
      </div>
    </div>
  );
};

export default OIRSubmissionResultView;
