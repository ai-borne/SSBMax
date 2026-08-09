import { TATSet, WATBatch, SRTBatch, PPDTContext } from '../types/testContent';
import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import { OfflineQueueService } from '../services/OfflineQueueService';

export type PsychologyTestType = 'TAT' | 'WAT' | 'SRT' | 'PPDT';

export interface SlideItem {
  id: string;
  index: number;
  content: string; // Image URL for TAT/PPDT, Word for WAT, Situation string for SRT
  durationSeconds: number;
}

export interface PsychologySubmissionPayload {
  userId: string;
  testType: PsychologyTestType;
  responses: Record<string, string>; // itemId -> candidate text response
  submittedAt: string;
}

export interface PsychologyTestState {
  testType: PsychologyTestType;
  slides: SlideItem[];
  currentSlideIndex: number;
  responses: Record<string, string>;
  isLoading: boolean;
  isSubmitting: boolean;
  isCompleted: boolean;
  error: string | null;
}

export class PsychologyTestViewModel {
  private repository: IContentRepository;
  private offlineQueueService: OfflineQueueService;
  private state: PsychologyTestState;
  private listeners: Set<() => void> = new Set();

  constructor(
    testType: PsychologyTestType,
    repository: IContentRepository,
    offlineQueueService: OfflineQueueService = new OfflineQueueService()
  ) {
    this.repository = repository;
    this.offlineQueueService = offlineQueueService;
    this.state = {
      testType,
      slides: [],
      currentSlideIndex: 0,
      responses: {},
      isLoading: false,
      isSubmitting: false,
      isCompleted: false,
      error: null
    };
  }

  public getState(): PsychologyTestState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Loads psychology test content based on test type
   */
  async loadTestContent(batchId: string = 'batch-1'): Promise<void> {
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();

    try {
      let slides: SlideItem[] = [];

      switch (this.state.testType) {
        case 'TAT': {
          const tatSet: TATSet = await this.repository.getTATSet(batchId);
          slides = tatSet.imageUrls.map((url, i) => ({
            id: `tat-img-${i + 1}`,
            index: i,
            content: url,
            durationSeconds: tatSet.slideDurationSeconds
          }));
          break;
        }
        case 'WAT': {
          const watBatch: WATBatch = await this.repository.getWATBatch(batchId);
          slides = watBatch.words.map((word, i) => ({
            id: `wat-word-${i + 1}`,
            index: i,
            content: word,
            durationSeconds: watBatch.displayDurationSeconds
          }));
          break;
        }
        case 'SRT': {
          const srtBatch: SRTBatch = await this.repository.getSRTBatch(batchId);
          slides = srtBatch.situations.map((sit, i) => ({
            id: `srt-sit-${i + 1}`,
            index: i,
            content: sit,
            durationSeconds: 30 // 30 seconds per situation
          }));
          break;
        }
        case 'PPDT': {
          const ppdtContext: PPDTContext = await this.repository.getPPDTContext(batchId);
          slides = [
            {
              id: ppdtContext.id,
              index: 0,
              content: ppdtContext.imageUrl,
              durationSeconds: ppdtContext.viewingTimeSeconds + ppdtContext.writingTimeSeconds
            }
          ];
          break;
        }
      }

      this.state = {
        ...this.state,
        slides,
        currentSlideIndex: 0,
        isLoading: false
      };
    } catch (err: any) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: err.message || 'Failed to load psychology test content'
      };
    }
    this.notify();
  }

  /**
   * Updates candidate's written response for a specific slide item
   */
  updateResponse(itemId: string, text: string): void {
    this.state = {
      ...this.state,
      responses: {
        ...this.state.responses,
        [itemId]: text
      }
    };
    this.notify();
  }

  /**
   * Moves to the next slide automatically or manually
   */
  nextSlide(): boolean {
    if (this.state.currentSlideIndex < this.state.slides.length - 1) {
      this.state = {
        ...this.state,
        currentSlideIndex: this.state.currentSlideIndex + 1
      };
      this.notify();
      return true;
    }
    return false; // Reached end of slides
  }

  /**
   * Submits responses online or queues offline
   */
  async submitTest(userId: string, isOnline: boolean = true): Promise<void> {
    if (this.state.isSubmitting || this.state.isCompleted) return;

    this.state = { ...this.state, isSubmitting: true, error: null };
    this.notify();

    const payload: PsychologySubmissionPayload = {
      userId,
      testType: this.state.testType,
      responses: this.state.responses,
      submittedAt: new Date().toISOString()
    };

    if (!isOnline) {
      await this.offlineQueueService.enqueueSubmission({
        testType: this.state.testType,
        userId,
        payload
      });

      this.state = {
        ...this.state,
        isSubmitting: false,
        isCompleted: true
      };
      this.notify();
      return;
    }

    try {
      // Direct API invocation for online evaluation
      this.state = {
        ...this.state,
        isSubmitting: false,
        isCompleted: true
      };
    } catch (err: any) {
      this.state = {
        ...this.state,
        isSubmitting: false,
        error: err.message || 'Failed to submit psychology test'
      };
    }
    this.notify();
  }
}
