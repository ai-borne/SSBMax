import { OIRQuestion } from '../types/testContent';
import { IContentRepository } from '../repositories/interfaces/IContentRepository';
import { OfflineQueueService } from '../services/OfflineQueueService';
import { SubmissionService, OIRSubmitPayload } from '../services/SubmissionService';
import { EligibilityService } from '../services/EligibilityService';

export interface OIREvaluationResult {
  score: number;
  totalQuestions: number;
  oirRating: number; // 1 (Superior) to 5 (Poor)
  percentage: number;
}

export interface OIRTestState {
  questions: OIRQuestion[];
  currentIndex: number;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  isLoading: boolean;
  isSubmitting: boolean;
  isCompleted: boolean;
  error: string | null;
  result: OIREvaluationResult | null;
  timeRemainingSeconds: number;
  batchId: string | null;
}

export class OIRTestViewModel {
  private repository: IContentRepository;
  private offlineQueueService: OfflineQueueService;
  private submissionService: SubmissionService;
  private eligibilityService: EligibilityService;
  private state: OIRTestState;
  private listeners: Set<() => void> = new Set();
  private totalDurationSeconds: number = 30 * 60; // 30 minutes for 50 questions

  constructor(
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
      questions: [],
      currentIndex: 0,
      answers: {},
      isLoading: false,
      isSubmitting: false,
      isCompleted: false,
      error: null,
      result: null,
      timeRemainingSeconds: this.totalDurationSeconds,
      batchId: null
    };
  }

  public getState(): OIRTestState {
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
   * Loads OIR questions batch from repository
   */
  async loadQuestions(batchIndex: number = 0): Promise<void> {
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();

    try {
      const batch = await this.repository.getOIRQuestions(batchIndex);
      // Strip any sensitive fields client-side to enforce anti-cheating standard
      const sanitizedQuestions: OIRQuestion[] = batch.items.map((q) => ({
        id: q.id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        options: q.options,
        imageUrl: q.imageUrl,
        type: q.type
      }));

      this.state = {
        ...this.state,
        questions: sanitizedQuestions,
        currentIndex: 0,
        isLoading: false,
        batchId: batch.id
      };
    } catch (err) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load OIR questions'
      };
    }
    this.notify();
  }

  /**
   * Selects an option for the current question
   */
  selectOption(questionId: string, optionIndex: number): void {
    if (this.state.isCompleted || this.state.isSubmitting) return;

    this.state = {
      ...this.state,
      answers: {
        ...this.state.answers,
        [questionId]: optionIndex
      }
    };
    this.notify();
  }

  /**
   * Navigation methods
   */
  nextQuestion(): void {
    if (this.state.currentIndex < this.state.questions.length - 1) {
      this.state = { ...this.state, currentIndex: this.state.currentIndex + 1 };
      this.notify();
    }
  }

  previousQuestion(): void {
    if (this.state.currentIndex > 0) {
      this.state = { ...this.state, currentIndex: this.state.currentIndex - 1 };
      this.notify();
    }
  }

  goToQuestion(index: number): void {
    if (index >= 0 && index < this.state.questions.length) {
      this.state = { ...this.state, currentIndex: index };
      this.notify();
    }
  }

  /**
   * Submits OIR test answers for anti-cheating server-side evaluation
   */
  async submitTest(userId: string, isOnline: boolean = true): Promise<void> {
    if (this.state.isSubmitting || this.state.isCompleted) return;

    this.state = { ...this.state, isSubmitting: true, error: null };
    this.notify();

    if (!isOnline) {
      // Enqueue the exact OIRSubmitPayload shape submitOIRTest expects, so resync can
      // replay it verbatim -- not a separate summary shape that would need reconstruction.
      const queuedPayload: OIRSubmitPayload = {
        batchId: this.state.batchId || 'oir-batch-1',
        userAnswers: this.state.answers,
        timeTakenSeconds: this.totalDurationSeconds - this.state.timeRemainingSeconds
      };
      await this.offlineQueueService.enqueueSubmission({
        testType: 'OIR',
        userId,
        payload: queuedPayload as unknown as Record<string, unknown>
      });

      this.state = {
        ...this.state,
        isSubmitting: false,
        isCompleted: true,
        error: null,
        result: {
          score: 0,
          totalQuestions: this.state.questions.length,
          oirRating: 0,
          percentage: 0
        }
      };
      this.notify();
      return;
    }

    try {
      if (!this.state.batchId) {
        throw new Error('Cannot submit: no batch loaded');
      }

      // Anti-cheating evaluation + persistence: answers sent to the server-side submitOIRTest
      // Cloud Function, which scores server-side (the answer keys never reach the client) AND
      // writes the submissions/{id} doc every other test type already gets -- previously OIR
      // never persisted a submission on web at all, so it had no result history and never fired
      // the centralized "your result is ready" notification (onOirSubmissionCreated fires off
      // this doc's creation).
      const evaluation = await this.submissionService.submitOIRTest({
        batchId: this.state.batchId,
        userAnswers: this.state.answers,
        timeTakenSeconds: this.totalDurationSeconds - this.state.timeRemainingSeconds
      });

      // Charge quota only after the score is durable server-side. A recordTestUsage failure
      // (including resource-exhausted, if the client-side eligibility check was stale) is
      // logged, not surfaced -- the evaluation already succeeded and the user has already
      // earned this result, matching the KMP submit use cases' same "log, don't block" handling.
      // Uses the real submissionId now (previously a throwaway crypto.randomUUID(), since there
      // was no real submission to reference).
      try {
        await this.eligibilityService.recordTestUsage('OIR', evaluation.submissionId);
      } catch (usageError) {
        console.error('Failed to record OIR test usage', usageError);
      }

      const evalResult: OIREvaluationResult = {
        score: evaluation.score,
        totalQuestions: evaluation.total,
        oirRating: evaluation.oirRating,
        percentage: evaluation.percentage
      };

      this.state = {
        ...this.state,
        isSubmitting: false,
        isCompleted: true,
        result: evalResult
      };
    } catch (err) {
      this.state = {
        ...this.state,
        isSubmitting: false,
        error: err instanceof Error ? err.message : 'Failed to submit test'
      };
    }
    this.notify();
  }
}
