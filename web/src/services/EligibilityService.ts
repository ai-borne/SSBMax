/**
 * Eligibility Service
 * Single Responsibility: calls the server-side `recordTestUsage` Cloud Function, the sole
 * authority (Phase 5, docs/plans/CrossPlatform_SSOT) on incrementing a user's monthly quota
 * counters and on refusing a submission that would exceed the tier's limit. Web previously had
 * no usage-recording path at all -- SubscriptionRepository only ever read usage, never wrote it
 * (writes go via Cloud Functions per web/CLAUDE.md's data-flow rule) -- so this callable is the
 * first and only way web records test usage.
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface RecordTestUsageResponse {
  success: boolean;
  alreadyRecorded: boolean;
  used: number;
  limit: number;
}

export class EligibilityService {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  async recordTestUsage(testType: string, submissionId?: string): Promise<RecordTestUsageResponse> {
    const callable = httpsCallable<
      { testType: string; submissionId?: string },
      RecordTestUsageResponse
    >(this.functionsInstance, 'recordTestUsage');
    const result = await callable({ testType, submissionId });
    return result.data;
  }
}
