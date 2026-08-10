import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OIRTestViewModel } from '../../src/viewmodels/OIRTestViewModel';
import { IContentRepository } from '../../src/repositories/interfaces/IContentRepository';
import { BatchDocument, OIRQuestion } from '../../src/types/testContent';

describe('OIRTestViewModel TDD Unit Tests', () => {
  let viewModel: OIRTestViewModel;
  let mockRepo: IContentRepository;
  let mockOfflineQueue: any;

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
      getCappedBatch: vi.fn(),
      getAvailableBatches: vi.fn().mockResolvedValue([])
    };


    mockOfflineQueue = {
      enqueueSubmission: vi.fn().mockResolvedValue(undefined)
    };

    viewModel = new OIRTestViewModel(mockRepo, mockOfflineQueue);
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

  it('should submit test online and return evaluation result', async () => {
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 2);
    viewModel.selectOption('q2', 0);

    await viewModel.submitTest('user-123', true);
    const state = viewModel.getState();

    expect(state.isCompleted).toBe(true);
    expect(state.result).not.toBeNull();
    expect(state.result?.totalQuestions).toBe(2);
  });

  it('should enqueue submission offline when network is unavailable', async () => {
    await viewModel.loadQuestions(0);
    viewModel.selectOption('q1', 1);

    await viewModel.submitTest('user-123', false);
    const state = viewModel.getState();

    expect(mockOfflineQueue.enqueueSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        testType: 'OIR'
      })
    );
    expect(state.isCompleted).toBe(true);
  });
});
