import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PsychologyTestViewModel } from '../../src/viewmodels/PsychologyTestViewModel';
import { IContentRepository } from '../../src/repositories/interfaces/IContentRepository';

describe('PsychologyTestViewModel TDD Unit Tests', () => {
  let mockRepo: IContentRepository;
  let mockOfflineQueue: any;

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
      getAvailableBatches: vi.fn().mockResolvedValue([])
    };


    mockOfflineQueue = {
      enqueueSubmission: vi.fn().mockResolvedValue(undefined)
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
    vm.updateResponse('tat-img-1', 'A young officer planning a village development project.');

    await vm.submitTest('user-456', false);
    const state = vm.getState();

    expect(mockOfflineQueue.enqueueSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        testType: 'TAT'
      })
    );
    expect(state.isCompleted).toBe(true);
  });
});
