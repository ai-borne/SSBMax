import { FC, useState } from 'react';
import { strings } from '../../constants/strings';
import { SubmissionService } from '../../services/SubmissionService';

/**
 * Interview capture UI (Phase 11c, Web SSB Test Flow Parity plan) -- previously nothing
 * existed on web for this test type. `submitInterviewResponse` (`functions/src/submissions.js`)
 * requires an existing `interview_sessions/{sessionId}` doc owned by the caller -- no
 * session-creation Cloud Function exists yet on web (KMP's interview flow creates
 * sessions directly via the GitLive SDK, an option web doesn't have per web/CLAUDE.md's
 * writes-via-Cloud-Function-only rule). Without `sessionId`, this renders capture-only
 * (matches the plan's "capture UI groundwork" scope for not-yet-reachable paths) --
 * submission wiring activates automatically once a `sessionId` is supplied by a future
 * session-orchestration flow, tracked as separate follow-up work, not silently dropped.
 */
export interface InterviewResponseCaptureProps {
  sessionId?: string;
  questionId: string;
  submissionService?: SubmissionService;
}

type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error';

export const InterviewResponseCapture: FC<InterviewResponseCaptureProps> = ({
  sessionId,
  questionId,
  submissionService = new SubmissionService()
}) => {
  const [responseText, setResponseText] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const t = strings.testRunner.interviewCapture;

  const handleSubmit = async () => {
    if (!sessionId) return;
    setStatus('submitting');
    setError(null);
    try {
      const { responseId } = await submissionService.submitInterviewResponse({
        sessionId,
        questionId,
        responseText,
        responseMode: 'TEXT_BASED'
      });
      await submissionService.evaluateInterviewResponse({ responseId, sessionId });
      setStatus('submitted');
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Failed to submit');
    }
  };

  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3" data-testid="interview-response-capture">
      <label className="text-sm font-extrabold text-white uppercase tracking-wider block">{t.responseLabel}</label>
      <textarea
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        placeholder={t.placeholder}
        rows={6}
        disabled={status === 'submitting' || status === 'submitted'}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-sm p-3"
        data-testid="interview-response-textarea"
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{responseText.length} {t.charCountSuffix}</span>
        {status === 'error' && (
          <span className="text-red-400" data-testid="interview-submit-error">{t.errorPrefix}{error}</span>
        )}
      </div>
      {!sessionId ? (
        <p className="text-xs text-amber-400" data-testid="interview-session-unavailable">{t.unavailableNotice}</p>
      ) : status === 'submitted' ? (
        <p className="text-xs text-emerald-400" data-testid="interview-submit-success">{t.submittedMessage}</p>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={status === 'submitting' || responseText.trim().length === 0}
          data-testid="interview-submit-button"
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold"
        >
          {status === 'submitting' ? t.submittingButton : t.submitButton}
        </button>
      )}
    </div>
  );
};

export default InterviewResponseCapture;
