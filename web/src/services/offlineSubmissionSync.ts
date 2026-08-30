/**
 * Replays one queued offline submission through the exact online call sequence its test type
 * uses -- `PsychologyTestViewModel.createSubmission()`'s per-testType switch, extended with
 * GTO's evaluable-subset logic from `GTOResponseForm`. Each `item.payload` was captured
 * verbatim from the same payload the online branch already builds (Phase 1/2), so this is a
 * direct replay, not a reconstruction.
 *
 * Returns `false` (never throws) on any failure -- `OfflineQueueService.syncPendingSubmissions`
 * already leaves a failed item queued for the next reconnect, so no retry logic belongs here.
 */
import {
  SubmissionService,
  PPDTSubmitPayload,
  TATSubmitPayload,
  WATResponseItem,
  SRTResponseItem,
  SDResponseItem,
  OIRSubmitPayload,
  GTOSubmitPayload
} from './SubmissionService';
import { EligibilityService } from './EligibilityService';
import { recordUsageThenEvaluate } from './testEvaluationOrchestrator';
import { QueuedSubmission } from './OfflineQueueService';
import { EVALUABLE_GTO_TYPES } from '../constants/gtoEvaluableTypes';

export async function resyncQueuedSubmission(
  item: QueuedSubmission,
  submissionService: SubmissionService,
  eligibilityService: EligibilityService
): Promise<boolean> {
  try {
    switch (item.testType) {
      case 'OIR': {
        // OIR scores at submit time -- SubmitOIRResponse already carries score/percentage,
        // so there's no separate evaluate* call to replay.
        await submissionService.submitOIRTest(item.payload as unknown as OIRSubmitPayload);
        return true;
      }
      case 'PPDT': {
        const { submissionId } = await submissionService.submitPPDTTest(item.payload as unknown as PPDTSubmitPayload);
        await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
          submissionService.evaluatePPDT({ submissionId })
        );
        return true;
      }
      case 'TAT': {
        const { submissionId } = await submissionService.submitTATTest(item.payload as unknown as TATSubmitPayload);
        await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
          submissionService.evaluateTAT({ submissionId })
        );
        return true;
      }
      case 'WAT': {
        const { submissionId } = await submissionService.submitWATTest(
          item.payload as unknown as { responses: WATResponseItem[] }
        );
        await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
          submissionService.evaluateWAT({ submissionId })
        );
        return true;
      }
      case 'SRT': {
        const { submissionId } = await submissionService.submitSRTTest(
          item.payload as unknown as { responses: SRTResponseItem[] }
        );
        await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
          submissionService.evaluateSRT({ submissionId })
        );
        return true;
      }
      case 'SD': {
        const { submissionId } = await submissionService.submitSDTest(
          item.payload as unknown as { responses: SDResponseItem[] }
        );
        await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
          submissionService.evaluateSD({ submissionId })
        );
        return true;
      }
      case 'GTO_GD':
      case 'GTO_GPE':
      case 'GTO_LECTURETTE':
      case 'GTO_PGT':
      case 'GTO_GOR':
      case 'GTO_HGT':
      case 'GTO_CT':
      case 'GTO_IO': {
        const { submissionId } = await submissionService.submitGTOTest(item.payload as unknown as GTOSubmitPayload);
        if (EVALUABLE_GTO_TYPES.has(item.testType)) {
          await recordUsageThenEvaluate(eligibilityService, item.testType, submissionId, () =>
            submissionService.evaluateGTO({ submissionId })
          );
        }
        return true;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
