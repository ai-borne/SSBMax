/**
 * OIR Scoring Service
 * Single Responsibility: calls the server-side `evaluateOIRAnswers` Cloud Function,
 * the anti-cheat authority for OIR scoring (see web/CLAUDE.md Anti-Cheating Invariants #1).
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface OIREvaluationResponse {
  success: boolean;
  score: number;
  total: number;
  percentage: number;
  oirRating: number;
}

export class OIRScoringService {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  async evaluateOIRAnswers(
    batchId: string,
    userAnswers: Record<string, number>
  ): Promise<OIREvaluationResponse> {
    const callable = httpsCallable<
      { batchId: string; userAnswers: Record<string, number> },
      OIREvaluationResponse
    >(this.functionsInstance, 'evaluateOIRAnswers');
    const result = await callable({ batchId, userAnswers });
    return result.data;
  }
}
