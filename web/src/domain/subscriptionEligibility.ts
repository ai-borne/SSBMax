/**
 * Web port of `com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase`
 * (docs/plans/CrossPlatform_SSOT Phase 4). Same decision shape on both platforms: remaining
 * quota, not a binary tier gate. Reads limits from the generated contract so a bucket can
 * never drift from `contracts/subscription.yaml`.
 */
import { SubscriptionLimits, SubscriptionTier, TestType } from '../generated/contracts';

export interface SubscriptionUsage {
  oirTestsUsed: number;
  ppdtTestsUsed: number;
  piqTestsUsed: number;
  tatTestsUsed: number;
  watTestsUsed: number;
  srtTestsUsed: number;
  sdTestsUsed: number;
  gtoTestsUsed: number;
  interviewTestsUsed: number;
}

export const EMPTY_USAGE: SubscriptionUsage = {
  oirTestsUsed: 0,
  ppdtTestsUsed: 0,
  piqTestsUsed: 0,
  tatTestsUsed: 0,
  watTestsUsed: 0,
  srtTestsUsed: 0,
  sdTestsUsed: 0,
  gtoTestsUsed: 0,
  interviewTestsUsed: 0,
};

/** Maps a bucket key (`contracts/subscription.yaml`) to the counter field on the usage doc. */
const USAGE_FIELD_BY_BUCKET: Record<string, keyof SubscriptionUsage> = {
  OIR: 'oirTestsUsed',
  PPDT: 'ppdtTestsUsed',
  PIQ: 'piqTestsUsed',
  TAT: 'tatTestsUsed',
  WAT: 'watTestsUsed',
  SRT: 'srtTestsUsed',
  SD: 'sdTestsUsed',
  GTO: 'gtoTestsUsed',
  INTERVIEW: 'interviewTestsUsed',
};

export type TestEligibility =
  | { status: 'ELIGIBLE'; remainingTests: number }
  | { status: 'LIMIT_REACHED'; tier: SubscriptionTier; limit: number; usedCount: number }
  | { status: 'NETWORK_ERROR' };

/** Bucket key in `SubscriptionLimits` for a given [testType] — mirrors `SubscriptionLimits.keyFor` in KMP. */
export function bucketKeyFor(testType: TestType): string {
  const bucket = SubscriptionLimits.find((limit) => limit.testTypes.includes(testType));
  if (!bucket) {
    throw new Error(`No subscription bucket configured for test type ${testType}`);
  }
  return bucket.bucket;
}

function limitFor(bucketKey: string, tier: SubscriptionTier): number {
  const bucket = SubscriptionLimits.find((limit) => limit.bucket === bucketKey);
  if (!bucket) return 0;
  switch (tier) {
    case 'BASIC':
      return bucket.basic;
    case 'PRO':
      return bucket.pro;
    case 'PREMIUM':
      return bucket.premium;
    case 'FREE':
    default:
      return bucket.free;
  }
}

/**
 * Pure decision function — no Firestore access. `tier`/`usage` are read by
 * `SubscriptionRepository` first and passed in, so this can be table-tested the same way as
 * the KMP `CheckTestEligibilityUseCaseTest` matrix.
 */
export function checkTestEligibility(
  testType: TestType,
  tier: SubscriptionTier,
  usage: SubscriptionUsage
): TestEligibility {
  const bucketKey = bucketKeyFor(testType);
  const limit = limitFor(bucketKey, tier);
  const used = usage[USAGE_FIELD_BY_BUCKET[bucketKey]] ?? 0;

  if (limit === -1 || used < limit) {
    return { status: 'ELIGIBLE', remainingTests: limit === -1 ? Number.MAX_SAFE_INTEGER : limit - used };
  }
  return { status: 'LIMIT_REACHED', tier, limit, usedCount: used };
}

/** Legacy global calendar-month key (UTC), e.g. "2026-08". FREE tier's permanent fallback. */
export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  // Date.UTC's day-of-month is 1-indexed; day 0 of `month` is the last day of `month - 1`,
  // i.e. the last day of `month` (still 1-indexed here) itself.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Billing-anniversary period key (Phase 3, `docs/plans/SubscriptionPricingRestructure.md` step
 * 5) — mirrors KMP's `CheckTestEligibilityUseCase.currentPeriodKey` and
 * `functions/src/eligibility.js`'s `currentPeriodKey` byte-for-byte (same UTC-based algorithm);
 * the three must agree or a client shows a stale "remaining tests" count before syncing with the
 * server, which is the real gate at submission time. A paid tier with a known `startDate` resets
 * on that day-of-month (clamped for short months); FREE tier / no `startDate` keeps the legacy
 * calendar-month key.
 */
export function currentPeriodKey(tier: SubscriptionTier, startDate: number | null): string {
  if (tier === 'FREE' || !startDate) {
    return currentYearMonth();
  }
  const now = new Date();
  const start = new Date(startDate);
  const anchorDay = start.getUTCDate();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  let clampedDay = Math.min(anchorDay, daysInMonth(year, month));
  if (now.getUTCDate() < clampedDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    clampedDay = Math.min(anchorDay, daysInMonth(year, month));
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}
