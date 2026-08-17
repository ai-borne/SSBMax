import { FirestorePaths } from '../generated/contracts';
import type { SSBMaxNotification } from '../types/notification';

/**
 * Maps a notification's `actionData.testType` (functions/src/notifications/sendNotification.js's
 * `TEST_TYPE_LABELS` keys) to the Firestore result collection `SubmissionResultView` reads from.
 * Same source-of-truth shape as `useOLQDashboardViewModel.ts`'s `OLQ_RESULT_SOURCES`, but keyed by
 * testType alone since the submissionId comes from the notification itself, not a dashboard query.
 * OIR is handled separately below (its own `kind`, not OLQ-scored). GTO's 5 not-yet-ported
 * sub-tests (PGT/GOR/HGT/IO/CT -- no `gto_results` doc written for them, matching the KMP-side
 * StudyContentGraph.kt gap) are intentionally absent and fall through to `null`.
 */
const TEST_TYPE_RESULT_COLLECTIONS: Record<string, string> = {
  PPDT: FirestorePaths.PPDT_RESULTS,
  TAT: FirestorePaths.PSYCH_RESULTS,
  WAT: FirestorePaths.PSYCH_RESULTS,
  SRT: FirestorePaths.PSYCH_RESULTS,
  SD: FirestorePaths.PSYCH_RESULTS,
  GTO_GD: FirestorePaths.GTO_RESULTS,
  GTO_GPE: FirestorePaths.GTO_RESULTS,
  GTO_LECTURETTE: FirestorePaths.GTO_RESULTS,
  IO: FirestorePaths.INTERVIEW_RESULTS
};

export type NotificationResultTarget =
  | { kind: 'olq'; submissionId: string; resultCollection: string }
  | { kind: 'oir'; submissionId: string };

/** Resolves a tapped notification to a result-view target, or `null` if it isn't a graded-result notification with a supported testType (e.g. the placeholder-only GTO sub-tests). */
export function resolveNotificationResultTarget(notification: SSBMaxNotification): NotificationResultTarget | null {
  const submissionId = notification.actionData?.submissionId;
  const testType = notification.actionData?.testType;
  if (!submissionId || !testType) return null;

  if (testType === 'OIR') {
    return { kind: 'oir', submissionId };
  }

  const resultCollection = TEST_TYPE_RESULT_COLLECTIONS[testType];
  if (!resultCollection) return null;

  return { kind: 'olq', submissionId, resultCollection };
}
