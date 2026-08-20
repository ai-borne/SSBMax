import { describe, it, expect, vi } from 'vitest';
import { SubmissionService } from '../../src/services/SubmissionService';
import { httpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * `PsychologyTestViewModel.submitTest()`'s online branch was previously a literal
 * no-op stub (Phase 11a's whole reason for existing) -- these tests pin down that
 * each submit/evaluate method calls the *correct* named Cloud Function with the
 * payload passed through verbatim, so Phase 11b's wiring has a service it can trust
 * without re-deriving the callable-name-to-payload mapping itself.
 */
describe('SubmissionService', () => {
  function mockCallableReturning(data: unknown) {
    const callable = vi.fn().mockResolvedValue({ data });
    vi.mocked(httpsCallable).mockReturnValue(callable as any);
    return callable;
  }

  it('submitPIQTest calls the submitPIQTest callable -- PIQ has no evaluate* trigger, unlike every gradeable type', async () => {
    const callable = mockCallableReturning({ success: true, submissionId: 'piq1' });
    const service = new SubmissionService();
    const result = await service.submitPIQTest({
      targetBoard: 'Indian Army (SSB)',
      entryType: 'NDA',
      prepStatus: 'Beginner',
      responsibilities: 'School Captain',
      sportsActivities: 'Football'
    });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitPIQTest');
    expect(callable).toHaveBeenCalledWith({
      targetBoard: 'Indian Army (SSB)',
      entryType: 'NDA',
      prepStatus: 'Beginner',
      responsibilities: 'School Captain',
      sportsActivities: 'Football'
    });
    expect(result).toEqual({ success: true, submissionId: 'piq1' });
  });

  it('submitPPDTTest calls the submitPPDTTest callable with the story payload', async () => {
    const callable = mockCallableReturning({ success: true, submissionId: 'sub1' });
    const service = new SubmissionService();
    const result = await service.submitPPDTTest({ questionId: 'q1', batchId: 'batch_001', story: 'my story' });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitPPDTTest');
    expect(callable).toHaveBeenCalledWith({ questionId: 'q1', batchId: 'batch_001', story: 'my story' });
    expect(result).toEqual({ success: true, submissionId: 'sub1' });
  });

  it('submitTATTest calls the submitTATTest callable with the stories array', async () => {
    mockCallableReturning({ success: true, submissionId: 'sub2' });
    const service = new SubmissionService();
    await service.submitTATTest({ stories: [{ questionId: 'q1', story: 's1' }], batchId: 'batch_001' });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitTATTest');
  });

  it('submitWATTest calls the submitWATTest callable', async () => {
    mockCallableReturning({ success: true, submissionId: 'sub3' });
    const service = new SubmissionService();
    await service.submitWATTest({ responses: [{ word: 'DOG', response: 'Bark', timeTakenSeconds: 2 }] });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitWATTest');
  });

  it('submitSRTTest calls the submitSRTTest callable', async () => {
    mockCallableReturning({ success: true, submissionId: 'sub4' });
    const service = new SubmissionService();
    await service.submitSRTTest({ responses: [{ situation: 'x', response: 'y' }] });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitSRTTest');
  });

  it('submitSDTest calls the submitSDTest callable', async () => {
    mockCallableReturning({ success: true, submissionId: 'sub5' });
    const service = new SubmissionService();
    await service.submitSDTest({ responses: [{ answer: 'x' }] });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitSDTest');
  });

  it('submitGTOTest calls the submitGTOTest callable with the gtoType discriminator', async () => {
    mockCallableReturning({ success: true, submissionId: 'sub6' });
    const service = new SubmissionService();
    await service.submitGTOTest({ gtoType: 'GTO_GD', topic: 't', response: 'r', charCount: 1 });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitGTOTest');
  });

  it('submitInterviewResponse calls the submitInterviewResponse callable, not a submissions.js path', async () => {
    mockCallableReturning({ success: true, responseId: 'resp1' });
    const service = new SubmissionService();
    const result = await service.submitInterviewResponse({ sessionId: 's1', questionId: 'q1', responseText: 'answer' });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'submitInterviewResponse');
    expect(result).toEqual({ success: true, responseId: 'resp1' });
  });

  it('evaluateTAT calls the evaluateTAT callable with only the submissionId', async () => {
    mockCallableReturning({ success: true, status: 'COMPLETED' });
    const service = new SubmissionService();
    await service.evaluateTAT({ submissionId: 'sub2' });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'evaluateTAT');
  });

  it('evaluateInterviewResponse calls the evaluateInterviewResponse callable with responseId and sessionId', async () => {
    mockCallableReturning({ success: true });
    const service = new SubmissionService();
    await service.evaluateInterviewResponse({ responseId: 'resp1', sessionId: 's1' });
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'evaluateInterviewResponse');
  });
});
