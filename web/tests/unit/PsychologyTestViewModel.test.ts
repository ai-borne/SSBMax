import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PsychologyTestViewModel } from '../../src/viewmodels/PsychologyTestViewModel';
import { IContentRepository } from '../../src/repositories/interfaces/IContentRepository';

describe('PsychologyTestViewModel TDD Unit Tests', () => {
  let mockRepo: IContentRepository;
  let mockOfflineQueue: any;
  let mockSubmissionService: any;
  let mockEligibilityService: any;

  beforeEach(() => {
    mockRepo = {
      getStudyMaterials: vi.fn(),
      getStudyMaterialById: vi.fn(),
      getOIRQuestions: vi.fn(),
      getPPDTContext: vi.fn().mockResolvedValue({
        id: 'ppdt-1',
        title: 'PPDT Test',
        imageUrl: 'https://example.com/ppdt.jpg',
        viewingTimeSeconds: 30,
        writingTimeSeconds: 240,
        instructions: ['Observe the picture']
      }),
      getTATSet: vi.fn().mockResolvedValue({
        id: 'tat-1',
        setName: 'Set 1',
        imageUrls: ['img1.jpg', 'img2.jpg'],
        imageIds: ['tat-content-1', 'tat-content-2'],
        slideDurationSeconds: 240,
        totalSlides: 2
      }),
      getWATBatch: vi.fn().mockResolvedValue({
        id: 'wat-1',
        words: ['COURAGE', 'HONESTY'],
        displayDurationSeconds: 15
      }),
      getSRTBatch: vi.fn().mockResolvedValue({
        id: 'srt-1',
        situations: ['He lost his way in a jungle. He...'],
        totalTimeMinutes: 30
      }),
      getGPEBatch: vi.fn(),
      getOIRContentVersion: vi.fn(),
      getAvailableBatches: vi.fn().mockResolvedValue([]),
      getStudyMaterialSections: vi.fn()
    };

    mockOfflineQueue = {
      enqueueSubmission: vi.fn().mockResolvedValue(undefined)
    };

    mockSubmissionService = {
      submitPPDTTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'ppdt-sub-1' }),
      submitTATTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'tat-sub-1' }),
      submitWATTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'wat-sub-1' }),
      submitSRTTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'srt-sub-1' }),
      submitSDTest: vi.fn().mockResolvedValue({ success: true, submissionId: 'sd-sub-1' }),
      evaluatePPDT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateTAT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateWAT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateSRT: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' }),
      evaluateSD: vi.fn().mockResolvedValue({ success: true, status: 'PENDING_ANALYSIS' })
    };

    mockEligibilityService = {
      recordTestUsage: vi.fn().mockResolvedValue({ success: true, alreadyRecorded: false, used: 1, limit: 10 })
    };
  });

  it('should load WAT slides correctly', async () => {
    const vm = new PsychologyTestViewModel('WAT', mockRepo, mockOfflineQueue);
    await vm.loadTestContent('wat-1');

    const state = vm.getState();
    expect(state.slides.length).toBe(2);
    expect(state.slides[0].content).toBe('COURAGE');
    expect(state.slides[0].durationSeconds).toBe(15);
  });

  it('should use the content batch imageIds as TAT slide ids, not synthetic ones, so submission questionIds match the server-side image batch', async () => {
    const vm = new PsychologyTestViewModel('TAT', mockRepo, mockOfflineQueue);
    await vm.loadTestContent('tat-1');
    expect(vm.getState().slides[0].id).toBe('tat-content-1');
    expect(vm.getState().slides[1].id).toBe('tat-content-2');
  });

  it('should update candidate responses and navigate slides', async () => {
    const vm = new PsychologyTestViewModel('WAT', mockRepo, mockOfflineQueue);
    await vm.loadTestContent('wat-1');

    vm.updateResponse('wat-word-1', 'Courage is facing fear with determination.');
    expect(vm.getState().responses['wat-word-1']).toBe('Courage is facing fear with determination.');

    const hasNext = vm.nextSlide();
    expect(hasNext).toBe(true);
    expect(vm.getState().currentSlideIndex).toBe(1);
  });

  it('should queue psychology test submission offline when internet is unavailable', async () => {
    const vm = new PsychologyTestViewModel('TAT', mockRepo, mockOfflineQueue);
    await vm.loadTestContent('tat-1');
    vm.updateResponse('tat-content-1', 'A young officer planning a village development project.');

    await vm.submitTest('user-456', false);
    const state = vm.getState();

    expect(mockOfflineQueue.enqueueSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        testType: 'TAT'
      })
    );
    expect(state.isCompleted).toBe(true);
  });

  describe('online submission (Phase 11b -- was previously a no-op stub)', () => {
    it('WAT: creates the submission with word/response pairs, triggers evaluateWAT, and records usage', async () => {
      const vm = new PsychologyTestViewModel('WAT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('wat-1');
      vm.updateResponse('wat-word-1', 'Facing danger head-on.');
      vm.updateResponse('wat-word-2', 'Telling the truth always.');

      await vm.submitTest('user-1', true);

      expect(mockSubmissionService.submitWATTest).toHaveBeenCalledWith({
        responses: [
          { word: 'COURAGE', response: 'Facing danger head-on.', timeTakenSeconds: 0 },
          { word: 'HONESTY', response: 'Telling the truth always.', timeTakenSeconds: 0 }
        ]
      });
      expect(mockSubmissionService.evaluateWAT).toHaveBeenCalledWith({ submissionId: 'wat-sub-1' });
      expect(mockEligibilityService.recordTestUsage).toHaveBeenCalledWith('WAT', 'wat-sub-1');
      expect(vm.getState().isCompleted).toBe(true);
      expect(vm.getState().error).toBeNull();
    });

    it('SRT: creates the submission with situation/response pairs and triggers evaluateSRT', async () => {
      const vm = new PsychologyTestViewModel('SRT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('srt-1');
      vm.updateResponse('srt-sit-1', 'He should ask a local for directions.');

      await vm.submitTest('user-1', true);

      expect(mockSubmissionService.submitSRTTest).toHaveBeenCalledWith({
        responses: [{ situation: 'He lost his way in a jungle. He...', response: 'He should ask a local for directions.' }]
      });
      expect(mockSubmissionService.evaluateSRT).toHaveBeenCalledWith({ submissionId: 'srt-sub-1' });
    });

    it('SD: creates the submission with one answer per paragraph and triggers evaluateSD', async () => {
      const vm = new PsychologyTestViewModel('SD', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent();
      vm.updateResponse('sd-1', 'Hardworking and disciplined.');

      await vm.submitTest('user-1', true);

      expect(mockSubmissionService.submitSDTest).toHaveBeenCalled();
      const call = mockSubmissionService.submitSDTest.mock.calls[0][0];
      expect(call.responses).toHaveLength(5);
      expect(call.responses[0]).toEqual({ answer: 'Hardworking and disciplined.' });
      expect(mockSubmissionService.evaluateSD).toHaveBeenCalledWith({ submissionId: 'sd-sub-1' });
    });

    it('PPDT: sends the slide id as questionId plus the loaded batchId, and triggers evaluatePPDT', async () => {
      const vm = new PsychologyTestViewModel('PPDT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('ppdt-batch-1');
      vm.updateResponse('ppdt-1', 'A story about resilience.');

      await vm.submitTest('user-1', true);

      expect(mockSubmissionService.submitPPDTTest).toHaveBeenCalledWith({
        questionId: 'ppdt-1',
        batchId: 'ppdt-batch-1',
        story: 'A story about resilience.'
      });
      expect(mockSubmissionService.evaluatePPDT).toHaveBeenCalledWith({ submissionId: 'ppdt-sub-1' });
    });

    it('TAT: sends every slide as a story keyed by its content-batch questionId, and triggers evaluateTAT', async () => {
      const vm = new PsychologyTestViewModel('TAT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('tat-1');
      vm.updateResponse('tat-content-1', 'Story one.');
      vm.updateResponse('tat-content-2', 'Story two.');

      await vm.submitTest('user-1', true);

      expect(mockSubmissionService.submitTATTest).toHaveBeenCalledWith({
        stories: [
          { questionId: 'tat-content-1', story: 'Story one.' },
          { questionId: 'tat-content-2', story: 'Story two.' }
        ],
        batchId: 'tat-1'
      });
      expect(mockSubmissionService.evaluateTAT).toHaveBeenCalledWith({ submissionId: 'tat-sub-1' });
    });

    it('sets an error and does not mark completed when the submit callable rejects', async () => {
      mockSubmissionService.submitWATTest.mockRejectedValueOnce(new Error('quota exceeded'));
      const vm = new PsychologyTestViewModel('WAT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('wat-1');

      await vm.submitTest('user-1', true);

      const state = vm.getState();
      expect(state.isCompleted).toBe(false);
      expect(state.error).toBe('quota exceeded');
    });

    it('a recordTestUsage failure blocks evaluation and surfaces as an error -- usage must be recorded before the costly evaluate* call runs, matching KMP\'s SubmitPPDTTestUseCase ordering', async () => {
      mockEligibilityService.recordTestUsage.mockRejectedValueOnce(new Error('Monthly quota reached for WAT (1/1)'));
      const vm = new PsychologyTestViewModel('WAT', mockRepo, mockOfflineQueue, mockSubmissionService, mockEligibilityService);
      await vm.loadTestContent('wat-1');

      await vm.submitTest('user-1', true);

      expect(vm.getState().isCompleted).toBe(false);
      expect(vm.getState().error).toContain('Monthly quota reached');
      expect(mockSubmissionService.evaluateWAT).not.toHaveBeenCalled();
    });
  });
});
