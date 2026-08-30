import { TATSet, WATBatch, SRTBatch, PPDTContext } from '../types/testContent';
import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import { OfflineQueueService } from '../services/OfflineQueueService';
import { SubmissionService } from '../services/SubmissionService';
import { EligibilityService } from '../services/EligibilityService';
import { recordUsageThenEvaluate } from '../services/testEvaluationOrchestrator';
import { FirestorePaths } from '../generated/contracts';

export type PsychologyTestType = 'TAT' | 'WAT' | 'SRT' | 'PPDT' | 'SD';

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
  batchId: string;
  isLoading: boolean;
  isSubmitting: boolean;
  isCompleted: boolean;
  error: string | null;
  lastSubmissionId: string | null;
  lastResultCollection: string | null;
}

export class PsychologyTestViewModel {
  private repository: IContentRepository;
  private offlineQueueService: OfflineQueueService;
  private submissionService: SubmissionService;
  private eligibilityService: EligibilityService;
  private state: PsychologyTestState;
  private listeners: Set<() => void> = new Set();

  constructor(
    testType: PsychologyTestType,
    repository: IContentRepository,
    offlineQueueService: OfflineQueueService = new OfflineQueueService(),
    submissionService: SubmissionService = new SubmissionService(),
    eligibilityService: EligibilityService = new EligibilityService()
  ) {
    this.repository = repository;
    this.offlineQueueService = offlineQueueService;
    this.submissionService = submissionService;
    this.eligibilityService = eligibilityService;
    this.state = {
      testType,
      slides: [],
      currentSlideIndex: 0,
      responses: {},
      batchId: 'batch_001',
      isLoading: false,
      isSubmitting: false,
      isCompleted: false,
      error: null,
      lastSubmissionId: null,
      lastResultCollection: null
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
  async loadTestContent(batchId: string = 'batch_001'): Promise<void> {
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();

    try {
      let slides: SlideItem[] = [];

      switch (this.state.testType) {
        case 'TAT': {
          const tatSet: TATSet = await this.repository.getTATSet(batchId);
          slides = tatSet.imageUrls.map((url, i) => ({
            id: tatSet.imageIds[i] || `tat-img-${i + 1}`,
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
        case 'SD': {
          slides = [
            { id: 'sd-1', index: 0, content: 'Paragraph 1: What your Parents think of you', durationSeconds: 180 },
            { id: 'sd-2', index: 1, content: 'Paragraph 2: What your Teachers / Employer think of you', durationSeconds: 180 },
            { id: 'sd-3', index: 2, content: 'Paragraph 3: What your Friends / Peers think of you', durationSeconds: 180 },
            { id: 'sd-4', index: 3, content: 'Paragraph 4: What you think of yourself (Strengths & Weaknesses)', durationSeconds: 180 },
            { id: 'sd-5', index: 4, content: 'Paragraph 5: What kind of person you wish to become', durationSeconds: 180 },
          ];
          break;
        }
      }

      this.state = {
        ...this.state,
        slides,
        currentSlideIndex: 0,
        batchId,
        isLoading: false
      };
    } catch (err) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load psychology test content'
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
        payload: payload as unknown as Record<string, unknown>
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
      const { submissionId, resultCollection } = await this.createSubmission();

      this.state = {
        ...this.state,
        isSubmitting: false,
        isCompleted: true,
        lastSubmissionId: submissionId,
        lastResultCollection: resultCollection
      };
    } catch (err) {
      this.state = {
        ...this.state,
        isSubmitting: false,
        error: err instanceof Error ? err.message : 'Failed to submit psychology test'
      };
    }
    this.notify();
  }

  /**
   * Creates the `submissions/{id}` doc, records quota usage, then calls `evaluate*` --
   * in that order, matching KMP's `SubmitPPDTTestUseCase` et al. (`recordTestUsage`
   * right after persisting, before analysis runs). Recording after `evaluate*` let the
   * real quota gate (`recordAndEnforce`) fire only once Gemini had already been paid for.
   */
  private async createSubmission(): Promise<{ submissionId: string; resultCollection: string }> {
    const { testType, slides, responses, batchId } = this.state;

    switch (testType) {
      case 'PPDT': {
        const slide = slides[0];
        const { submissionId } = await this.submissionService.submitPPDTTest({
          questionId: slide.id,
          batchId,
          story: responses[slide.id] || ''
        });
        await recordUsageThenEvaluate(this.eligibilityService, testType, submissionId, () => this.submissionService.evaluatePPDT({ submissionId }));
        return { submissionId, resultCollection: FirestorePaths.PPDT_RESULTS };
      }
      case 'TAT': {
        const stories = slides.map((s) => ({ questionId: s.id, story: responses[s.id] || '' }));
        const { submissionId } = await this.submissionService.submitTATTest({ stories, batchId });
        await recordUsageThenEvaluate(this.eligibilityService, testType, submissionId, () => this.submissionService.evaluateTAT({ submissionId }));
        return { submissionId, resultCollection: FirestorePaths.PSYCH_RESULTS };
      }
      case 'WAT': {
        // timeTakenSeconds isn't tracked per-response on web yet; evaluateWAT doesn't score on it.
        const responseItems = slides.map((s) => ({ word: s.content, response: responses[s.id] || '', timeTakenSeconds: 0 }));
        const { submissionId } = await this.submissionService.submitWATTest({ responses: responseItems });
        await recordUsageThenEvaluate(this.eligibilityService, testType, submissionId, () => this.submissionService.evaluateWAT({ submissionId }));
        return { submissionId, resultCollection: FirestorePaths.PSYCH_RESULTS };
      }
      case 'SRT': {
        const responseItems = slides.map((s) => ({ situation: s.content, response: responses[s.id] || '' }));
        const { submissionId } = await this.submissionService.submitSRTTest({ responses: responseItems });
        await recordUsageThenEvaluate(this.eligibilityService, testType, submissionId, () => this.submissionService.evaluateSRT({ submissionId }));
        return { submissionId, resultCollection: FirestorePaths.PSYCH_RESULTS };
      }
      case 'SD': {
        const responseItems = slides.map((s) => ({ answer: responses[s.id] || '' }));
        const { submissionId } = await this.submissionService.submitSDTest({ responses: responseItems });
        await recordUsageThenEvaluate(this.eligibilityService, testType, submissionId, () => this.submissionService.evaluateSD({ submissionId }));
        return { submissionId, resultCollection: FirestorePaths.PSYCH_RESULTS };
      }
    }
  }
}
