/**
 * Shared submit -> record-usage -> evaluate ordering (Tier-2 orchestration).
 * Every web test-runner component that calls an `evaluate*` Cloud Function must record
 * quota usage first -- KMP's `SubmitPPDTTestUseCase`/`GTOSubmissionCoordinator` et al.
 * all call `usageRecorder.recordTestUsage` immediately after the submission is durable,
 * before analysis ever runs. Routing every call site through this one helper (instead of
 * hand-sequencing `recordTestUsage` + `evaluate*` per component) is what stops that
 * ordering from silently regressing per-file -- which is exactly how `GTOResponseForm`
 * ended up calling `evaluateGTO` with no quota recording at all.
 */
export interface UsageRecorder {
  recordTestUsage(testType: string, submissionId?: string): Promise<unknown>;
}

export async function recordUsageThenEvaluate<T>(
  usageRecorder: UsageRecorder,
  testType: string,
  submissionId: string,
  evaluate: () => Promise<T>
): Promise<T> {
  await usageRecorder.recordTestUsage(testType, submissionId);
  return evaluate();
}
