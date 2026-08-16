/**
 * Submission Service
 * Single Responsibility: calls the server-side `submit*`/`evaluate*` Cloud Functions
 * (`functions/src/submissions.js`) that create `submissions/{id}` docs -- required
 * because writes go via Cloud Functions per web/CLAUDE.md's data-flow rule (unlike
 * KMP, which writes Firestore directly via the GitLive SDK). Mirrors `OIRScoringService`'s
 * shape: one thin `httpsCallable` wrapper per server function, no business logic here.
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface SubmitSubmissionResponse {
  success: boolean;
  submissionId: string;
}

export interface SubmitInterviewResponseResult {
  success: boolean;
  responseId: string;
}

/** Matches `PIQData` (`web/src/components/practice/piq/PIQWizardContainer.tsx`). */
export interface PIQSubmitPayload {
  targetBoard: string;
  entryType: string;
  prepStatus: string;
  responsibilities: string;
  sportsActivities: string;
}

export interface PPDTSubmitPayload {
  questionId: string;
  batchId?: string;
  story: string;
}

export interface TATStoryPayload {
  questionId: string;
  story: string;
}

export interface TATSubmitPayload {
  stories: TATStoryPayload[];
  batchId?: string;
}

export interface WATResponseItem {
  word: string;
  response: string;
  timeTakenSeconds: number;
}

export interface SRTResponseItem {
  situation: string;
  response: string;
}

export interface SDResponseItem {
  answer: string;
}

/** `gtoType` is a contract `TestType` id, e.g. `GTO_GD`; remaining fields are the sub-type's capture data. */
export interface GTOSubmitPayload {
  gtoType: string;
  [field: string]: unknown;
}

export interface InterviewSubmitPayload {
  sessionId: string;
  questionId: string;
  responseText: string;
  responseMode?: string;
}

export class SubmissionService {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  private call<TPayload, TResult>(name: string) {
    return (payload: TPayload) => httpsCallable<TPayload, TResult>(this.functionsInstance, name)(payload).then((r) => r.data);
  }

  submitPIQTest = this.call<PIQSubmitPayload, SubmitSubmissionResponse>('submitPIQTest');
  submitPPDTTest = this.call<PPDTSubmitPayload, SubmitSubmissionResponse>('submitPPDTTest');
  submitTATTest = this.call<TATSubmitPayload, SubmitSubmissionResponse>('submitTATTest');
  submitWATTest = this.call<{ responses: WATResponseItem[] }, SubmitSubmissionResponse>('submitWATTest');
  submitSRTTest = this.call<{ responses: SRTResponseItem[] }, SubmitSubmissionResponse>('submitSRTTest');
  submitSDTest = this.call<{ responses: SDResponseItem[] }, SubmitSubmissionResponse>('submitSDTest');
  submitGTOTest = this.call<GTOSubmitPayload, SubmitSubmissionResponse>('submitGTOTest');
  submitInterviewResponse = this.call<InterviewSubmitPayload, SubmitInterviewResponseResult>('submitInterviewResponse');

  evaluatePPDT = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluatePPDT');
  evaluateTAT = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluateTAT');
  evaluateWAT = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluateWAT');
  evaluateSRT = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluateSRT');
  evaluateSD = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluateSD');
  evaluateGTO = this.call<{ submissionId: string }, { success: boolean; status: string }>('evaluateGTO');
  evaluateInterviewResponse = this.call<{ responseId: string; sessionId: string }, { success: boolean }>(
    'evaluateInterviewResponse'
  );
}
