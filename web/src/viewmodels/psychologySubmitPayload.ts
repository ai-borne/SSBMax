import {
  PPDTSubmitPayload,
  TATSubmitPayload,
  WATResponseItem,
  SRTResponseItem,
  SDResponseItem
} from '../services/SubmissionService';
import type { PsychologyTestType, SlideItem } from './PsychologyTestViewModel';

/** The exact payload shape each type's `submit*Test` callable expects -- what gets queued
 * offline is this, verbatim, not a separate summary shape (see `buildPsychologySubmitPayload`). */
export type PsychologySubmitPayload =
  | PPDTSubmitPayload
  | TATSubmitPayload
  | { responses: WATResponseItem[] }
  | { responses: SRTResponseItem[] }
  | { responses: SDResponseItem[] };

/**
 * Builds the exact payload each type's `submit*Test` callable expects, from current slide/
 * response state. Shared by `PsychologyTestViewModel`'s online path (`createSubmission`) and its
 * offline queue enqueue so both derive the same shape from the same source -- no separate
 * summary shape to drift.
 */
export function buildPsychologySubmitPayload(
  testType: PsychologyTestType,
  slides: SlideItem[],
  responses: Record<string, string>,
  batchId: string
): PsychologySubmitPayload {
  switch (testType) {
    case 'PPDT': {
      const slide = slides[0];
      return { questionId: slide.id, batchId, story: responses[slide.id] || '' };
    }
    case 'TAT':
      return { stories: slides.map((s) => ({ questionId: s.id, story: responses[s.id] || '' })), batchId };
    case 'WAT':
      // timeTakenSeconds isn't tracked per-response on web yet; evaluateWAT doesn't score on it.
      return { responses: slides.map((s) => ({ word: s.content, response: responses[s.id] || '', timeTakenSeconds: 0 })) };
    case 'SRT':
      return { responses: slides.map((s) => ({ situation: s.content, response: responses[s.id] || '' })) };
    case 'SD':
      return { responses: slides.map((s) => ({ answer: responses[s.id] || '' })) };
  }
}
