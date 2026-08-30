import { FC, useState } from 'react';
import { Clock } from 'lucide-react';
import { strings } from '../../constants/strings';
import { SubmissionService } from '../../services/SubmissionService';
import { EligibilityService } from '../../services/EligibilityService';
import { recordUsageThenEvaluate } from '../../services/testEvaluationOrchestrator';
import { SubmissionResultView } from '../evaluation/SubmissionResultView';
import { FirestorePaths } from '../../generated/contracts';

/**
 * Only GD/GPE/Lecturette have a matching `evaluateGTO` prompt path today
 * (`GTO_SUBTYPE_CONFIG` in `functions/src/evaluation/gtoEvaluate.js`) -- PGT/HGT/GOR/CT/IO
 * submissions are still created (capture-UI groundwork, plan §C.4) but never trigger
 * evaluation, since calling `evaluateGTO` on one would fail with `invalid-argument`.
 */
const EVALUABLE_GTO_TYPES = new Set(['GTO_GD', 'GTO_GPE', 'GTO_LECTURETTE']);

/** Builds the `data` payload each `gtoType` server-side prompt builder actually reads. */
function buildSubmissionData(gtoType: string, topic: string, text: string): Record<string, unknown> {
  switch (gtoType) {
    case 'GTO_GD':
      return { topic, response: text, charCount: text.length };
    case 'GTO_GPE':
      return { scenario: topic, plan: text, characterCount: text.length };
    case 'GTO_LECTURETTE':
      return { selectedTopic: topic, topicChoices: [topic], speechTranscript: text, charCount: text.length };
    default:
      return { notes: text };
  }
}

export interface GTOResponseFormProps {
  /** Contract `TestType` id, e.g. `GTO_GD`. */
  gtoType: string;
  topic: string;
  submissionService?: SubmissionService;
  eligibilityService?: EligibilityService;
}

type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error';

export const GTOResponseForm: FC<GTOResponseFormProps> = ({
  gtoType,
  topic,
  submissionService = new SubmissionService(),
  eligibilityService = new EligibilityService()
}) => {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const t = strings.testRunner.gtoCapture;

  const handleSubmit = async () => {
    setStatus('submitting');
    setError(null);
    try {
      const { submissionId: newSubmissionId } = await submissionService.submitGTOTest({
        gtoType,
        ...buildSubmissionData(gtoType, topic, response)
      });
      if (EVALUABLE_GTO_TYPES.has(gtoType)) {
        await recordUsageThenEvaluate(eligibilityService, gtoType, newSubmissionId, () =>
          submissionService.evaluateGTO({ submissionId: newSubmissionId })
        );
      }
      setSubmissionId(newSubmissionId);
      setStatus('submitted');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3" data-testid="gto-response-form">
      <label className="text-sm font-extrabold text-white uppercase tracking-wider block">{t.responseLabel}</label>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={8}
        disabled={status === 'submitting' || status === 'submitted'}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-sm p-3"
        data-testid="gto-response-textarea"
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{response.length} {t.charCountSuffix}</span>
        {status === 'error' && (
          <span className="text-red-400" data-testid="gto-submit-error">{t.errorPrefix}{error}</span>
        )}
      </div>
      {status === 'submitted' ? (
        <div className="space-y-3">
          <p className="text-xs text-emerald-400" data-testid="gto-submit-success">
            {EVALUABLE_GTO_TYPES.has(gtoType) ? t.submittedMessage : t.groundworkNotice}
          </p>
          {EVALUABLE_GTO_TYPES.has(gtoType) && submissionId && (
            <SubmissionResultView submissionId={submissionId} resultCollection={FirestorePaths.GTO_RESULTS} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {status === 'submitting' && (
            <p className="flex items-center text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              {t.submittingNotice}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting' || response.trim().length === 0}
            data-testid="gto-submit-button"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center"
          >
            {status === 'submitting' && <Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {status === 'submitting' ? t.submittingButton : t.submitButton}
          </button>
        </div>
      )}
    </div>
  );
};

export default GTOResponseForm;
