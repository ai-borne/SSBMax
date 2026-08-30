import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OIRTestViewModel } from '../../src/viewmodels/OIRTestViewModel';
import { IContentRepository } from '../../src/repositories/interfaces/IContentRepository';
import { BatchDocument, OIRQuestion } from '../../src/types/testContent';
import type { OfflineQueueService } from '../../src/services/OfflineQueueService';
import type { SubmissionService } from '../../src/services/SubmissionService';
import type { EligibilityService } from '../../src/services/EligibilityService';
import type { Mocked } from 'vitest';

describe('OIRTestViewModel TDD Unit Tests', () => {
  let viewModel: OIRTestViewModel;
  let mockRepo: IContentRepository;
  let mockOfflineQueue: OfflineQueueService;
  let mockScoringService: SubmissionService;
  let mockEligibilityService: Mocked<EligibilityService>;

  const sampleQuestions: OIRQuestion[] = [
    {
      id: 'q1',
      questionNumber: 1,
      questionText: 'Which number completes the series?',
      options: ['2', '4', '6', '8'],
      type: 'VERBAL'
    },
    {
      id: 'q2',
      questionNumber: 2,
      questionText: 'Find the odd one out.',
      options: ['Apple', 'Banana', 'Carrot', 'Date'],
      type: 'VERBAL'
    }
  ];

  const mockBatch: BatchDocument<OIRQuestion> = {
    id: 'oir-batch-0',
    batchIndex: 0,
    totalItems: 2,
    items: sampleQuestions
  };

  beforeEach(() => {
    mockRepo = {
      getStudyMaterials: vi.fn(),
      getStudyMaterialById: vi.fn(),
      getOIRQuestions: vi.fn().mockResolvedValue(mockBatch),
      getPPDTContext: vi.fn(),
      getTATSet: vi.fn(),
      getWATBatch: vi.fn(),
      getSRTBatch: vi.fn(),
      getGPEBatch: vi.fn(),
      getOIRContentVersion: vi.fn(),
      getAvailableBatches: vi.fn().mockResolvedValue([]),
      getStudyMaterialSections: vi.fn()
    };


    mockOfflineQueue = {
      enqueueSubmission: vi.fn().mockResolvedValue(undefined)
    } as unknown as OfflineQueueService;

    mockScoringService = {
      submitOIRTest: vi.fn().mockResolvedValue({
        success: true,
        submissionId: 'sub-oir-1',
        score: 1,
        total: 2,
        percentage: 50,
        oirRating: 3
      })
    } as unknown as SubmissionService;

    mockEligibilityService = {
      recordTestUsage: vi.fn().mockResolvedValue({ success: true, alreadyRecorded: false, used: 1, limit: 5 })
    } as unknown as Mocked<EligibilityService>;

    viewModel = new OIRTestViewModel(mockRepo, mockOfflineQueue, mockScoringService, mockEligibilityService);
  });

  it('should load questions and initialize state correctly', async () => {
    await viewModel.loadQuestions(0);
    const state = viewModel.getState();

    expect(state.isLoading).toBe(false);
    expect(state.questions.length).toBe(2);
    expect(state.currentIndex).toBe(0);
    expect(state.questions[0].id).toBe('q1');
  });

  it('should allow option selection and navigation', async () => {
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 2);

    let state = viewModel.getState();
    expect(state.answers['q1']).toBe(2);

    viewModel.nextQuestion();
    state = viewModel.getState();
    expect(state.currentIndex).toBe(1);

    viewModel.previousQuestion();
    state = viewModel.getState();
    expect(state.currentIndex).toBe(0);
  });

  it('should submit test online via the server-side submitOIRTest function and return its result', async () => {
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 2);
    viewModel.selectOption('q2', 0);

    await viewModel.submitTest('user-123', true);
    const state = viewModel.getState();

    expect(mockScoringService.submitOIRTest).toHaveBeenCalledWith({
      batchId: 'oir-batch-0',
      userAnswers: { q1: 2, q2: 0 },
      timeTakenSeconds: expect.any(Number)
    });
    expect(state.isCompleted).toBe(true);
    expect(state.result).not.toBeNull();
    expect(state.result?.totalQuestions).toBe(2);
    expect(state.result?.score).toBe(1);
    // Phase 5 (docs/plans/CrossPlatform_SSOT): quota is only charged after the score is
    // durable server-side -- this is the first and only place web records OIR usage.
    // Regression (OIR notification/persistence parity fix): uses the real submissionId
    // submitOIRTest returns, not a throwaway crypto.randomUUID() with nothing behind it.
    expect(mockEligibilityService.recordTestUsage).toHaveBeenCalledWith('OIR', 'sub-oir-1');
  });

  it('still completes and shows the result even if recordTestUsage fails (log, do not block an already-earned score)', async () => {
    mockEligibilityService.recordTestUsage.mockRejectedValue(new Error('resource-exhausted'));
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 2);
    viewModel.selectOption('q2', 0);

    await viewModel.submitTest('user-123', true);
    const state = viewModel.getState();

    expect(state.isCompleted).toBe(true);
    expect(state.result?.score).toBe(1);
  });

  it('should surface an error and never fabricate a score when no batch is loaded before submit', async () => {
    await viewModel.submitTest('user-123', true);
    const state = viewModel.getState();

    expect(mockScoringService.submitOIRTest).not.toHaveBeenCalled();
    expect(state.isCompleted).toBe(false);
    expect(state.error).toBeTruthy();
  });

  it('should enqueue submission offline when network is unavailable, in the exact payload shape submitOIRTest expects', async () => {
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 1);

    await viewModel.submitTest('user-123', false);
    const state = viewModel.getState();

    expect(mockOfflineQueue.enqueueSubmission).toHaveBeenCalledWith({
      testType: 'OIR',
      userId: 'user-123',
      payload: {
        batchId: 'oir-batch-0',
        userAnswers: { q1: 1 },
        timeTakenSeconds: expect.any(Number)
      }
    });
    expect(state.isCompleted).toBe(true);
  });
});
