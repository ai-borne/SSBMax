import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { resyncQueuedSubmission } from '../../src/services/offlineSubmissionSync';
import type { SubmissionService } from '../../src/services/SubmissionService';
import type { EligibilityService } from '../../src/services/EligibilityService';
import type { QueuedSubmission } from '../../src/services/OfflineQueueService';

function queued(testType: QueuedSubmission['testType'], payload: Record<string, unknown>): QueuedSubmission {
  return { id: 'q1', testType, userId: 'user-1', payload, timestamp: 1 };
}

describe('resyncQueuedSubmission', () => {
  let submissionService: Mocked<SubmissionService>;
  let eligibilityService: Mocked<EligibilityService>;

  beforeEach(() => {
    submissionService = {
      submitOIRTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'oir-sub-1', score: 1, total: 2, percentage: 50, oirRating: 3 }),
      submitPPDTTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'ppdt-sub-1' }),
      submitTATTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'tat-sub-1' }),
      submitWATTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'wat-sub-1' }),
      submitSRTTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'srt-sub-1' }),
      submitSDTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'sd-sub-1' }),
      submitGTOTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'gto-sub-1' }),
      evaluatePPDT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateTAT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateWAT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateSRT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateSD: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateGTO: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' })
    } as unknown as Mocked<SubmissionService>;

    eligibilityService = {
      recordTestUsage: vi.fn().mockResolvedValue({ success: true, alreadyRecorded: false, used: 1, limit: 10 })
    } as unknown as Mocked<EligibilityService>;
  });

  it('OIR: calls submitOIRTest verbatim with the queued payload and does not evaluate -- OIR scores at submit time', async () => {
    const payload = { batchId: 'oir-batch-1', userAnswers: { q1: 2 }, timeTakenSeconds: 90 };
    const result = await resyncQueuedSubmission(queued('OIR', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitOIRTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).not.toHaveBeenCalled();
  });

  it('PPDT: submits then records usage before evaluating, matching the online createSubmission() ordering', async () => {
    const payload = { questionId: 'q1', batchId: 'ppdt-batch-1', story: 'My story' };
    const callOrder: string[] = [];
    eligibilityService.recordTestUsage.mockImplementation(async () => {
      callOrder.push('recordTestUsage');
      return { success: true, alreadyRecorded: false, used: 1, limit: 10 };
    });
    submissionService.evaluatePPDT.mockImplementation(async () => {
      callOrder.push('evaluatePPDT');
      return { success: true, status: 'PENDING_ANALYSIS' };
    });

    const result = await resyncQueuedSubmission(queued('PPDT', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitPPDTTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('PPDT', 'ppdt-sub-1');
    expect(submissionService.evaluatePPDT).toHaveBeenCalledWith({ submissionId: 'ppdt-sub-1' });
    expect(callOrder).toEqual(['recordTestUsage', 'evaluatePPDT']);
  });

  it('TAT: submits then evaluates with the queued payload verbatim', async () => {
    const payload = { stories: [{ questionId: 'tat-1', story: 'A story' }], batchId: 'tat-batch-1' };
    const result = await resyncQueuedSubmission(queued('TAT', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitTATTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('TAT', 'tat-sub-1');
    expect(submissionService.evaluateTAT).toHaveBeenCalledWith({ submissionId: 'tat-sub-1' });
  });

  it('WAT: submits then evaluates with the queued payload verbatim', async () => {
    const payload = { responses: [{ word: 'COURAGE', response: 'Bravery', timeTakenSeconds: 12 }] };
    const result = await resyncQueuedSubmission(queued('WAT', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitWATTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('WAT', 'wat-sub-1');
    expect(submissionService.evaluateWAT).toHaveBeenCalledWith({ submissionId: 'wat-sub-1' });
  });

  it('SRT: submits then evaluates with the queued payload verbatim', async () => {
    const payload = { responses: [{ situation: 'Lost in a jungle', response: 'Found the way' }] };
    const result = await resyncQueuedSubmission(queued('SRT', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitSRTTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('SRT', 'srt-sub-1');
    expect(submissionService.evaluateSRT).toHaveBeenCalledWith({ submissionId: 'srt-sub-1' });
  });

  it('SD: submits then evaluates with the queued payload verbatim', async () => {
    const payload = { responses: [{ answer: 'My self-description' }] };
    const result = await resyncQueuedSubmission(queued('SD', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitSDTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('SD', 'sd-sub-1');
    expect(submissionService.evaluateSD).toHaveBeenCalledWith({ submissionId: 'sd-sub-1' });
  });

  it('GTO (evaluable, GTO_GD): submits then evaluates, matching online GTOResponseForm behavior', async () => {
    const payload = { gtoType: 'GTO_GD', topic: 'Leadership', response: 'My response', charCount: 11 };
    const result = await resyncQueuedSubmission(queued('GTO_GD', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitGTOTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).toHaveBeenCalledWith('GTO_GD', 'gto-sub-1');
    expect(submissionService.evaluateGTO).toHaveBeenCalledWith({ submissionId: 'gto-sub-1' });
  });

  it('GTO (non-evaluable, GTO_PGT): submits but skips evaluate/recordTestUsage, matching online GTOResponseForm behavior', async () => {
    const payload = { gtoType: 'GTO_PGT', notes: 'My notes' };
    const result = await resyncQueuedSubmission(queued('GTO_PGT', payload), submissionService, eligibilityService);

    expect(result).toBe(true);
    expect(submissionService.submitGTOTest).toHaveBeenCalledWith(payload);
    expect(eligibilityService.recordTestUsage).not.toHaveBeenCalled();
    expect(submissionService.evaluateGTO).not.toHaveBeenCalled();
  });

  it('returns false without throwing when the submit call fails, leaving the item for the next reconnect', async () => {
    submissionService.submitTATTest.mockRejectedValue(new Error('network error'));
    const payload = { stories: [{ questionId: 'tat-1', story: 'A story' }], batchId: 'tat-batch-1' };

    await expect(resyncQueuedSubmission(queued('TAT', payload), submissionService, eligibilityService)).resolves.toBe(false);
  });

  it('returns false without throwing when recordTestUsage rejects (quota exhausted on resync)', async () => {
    eligibilityService.recordTestUsage.mockRejectedValue(new Error('Monthly quota reached'));
    const payload = { responses: [{ answer: 'My self-description' }] };

    await expect(resyncQueuedSubmission(queued('SD', payload), submissionService, eligibilityService)).resolves.toBe(false);
  });
});
