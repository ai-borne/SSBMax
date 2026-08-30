import { describe, it, expect, vi } from 'vitest';
import { bucketKeyFor, checkTestEligibility, currentPeriodKey, currentYearMonth, EMPTY_USAGE } from '../../../src/domain/subscriptionEligibility';
import { SubscriptionLimits, SubscriptionTierValues, TestTypeValues } from '../../../src/generated/contracts';

/**
 * Web mirror of shared/src/commonTest/.../SubscriptionLimitsTest.kt and
 * CheckTestEligibilityUseCaseTest.kt (docs/plans/CrossPlatform_SSOT Phase 4 TDD requirement:
 * "table-driven test over {3 tiers} x {9 test types} x {quota consumed} asserting the same
 * allow/deny decision — run in both the KMP and web suites off the same generated limits
 * table"). A regression here (e.g. FREE OIR silently going from 1 to 0) would leak paid
 * features to free users or lock out entitled ones with nothing else to catch it.
 */
describe('subscriptionEligibility', () => {
  it('maps every TestType to a bucket key present in the generated limits table', () => {
    const bucketKeys = new Set(SubscriptionLimits.map((l) => l.bucket));
    TestTypeValues.forEach((testType) => {
      expect(bucketKeys.has(bucketKeyFor(testType))).toBe(true);
    });
  });

  it('groups all 8 GTO sub-tests under the same bucket key', () => {
    const gtoTypes = ['GTO_GD', 'GTO_GPE', 'GTO_PGT', 'GTO_GOR', 'GTO_HGT', 'GTO_LECTURETTE', 'GTO_IO', 'GTO_CT'] as const;
    gtoTypes.forEach((t) => expect(bucketKeyFor(t)).toBe('GTO'));
  });

  it('is eligible below the limit and reports remaining count', () => {
    const result = checkTestEligibility('OIR', 'PRO', { ...EMPTY_USAGE, oirTestsUsed: 2 });
    expect(result).toEqual({ status: 'ELIGIBLE', remainingTests: 6 });
  });

  it('reaches the limit exactly at the boundary, not one before it', () => {
    const atLimit = checkTestEligibility('TAT', 'PRO', { ...EMPTY_USAGE, tatTestsUsed: 8 });
    expect(atLimit.status).toBe('LIMIT_REACHED');

    const oneBelow = checkTestEligibility('TAT', 'PRO', { ...EMPTY_USAGE, tatTestsUsed: 7 });
    expect(oneBelow.status).toBe('ELIGIBLE');
  });

  it('treats -1 as unlimited regardless of usage (PIQ, the one bucket still uncapped at PREMIUM)', () => {
    const result = checkTestEligibility('PIQ', 'PREMIUM', { ...EMPTY_USAGE, piqTestsUsed: 9999 });
    expect(result).toEqual({ status: 'ELIGIBLE', remainingTests: Number.MAX_SAFE_INTEGER });
  });

  it('denies FREE tier access to buckets with a zero limit (TAT/WAT/SRT/SD/GTO/Interview)', () => {
    const zeroLimitTypes: ('TAT' | 'WAT' | 'SRT' | 'SD' | 'GTO_GD' | 'IO')[] = ['TAT', 'WAT', 'SRT', 'SD', 'GTO_GD', 'IO'];
    zeroLimitTypes.forEach((t) => {
      expect(checkTestEligibility(t, 'FREE', EMPTY_USAGE).status).toBe('LIMIT_REACHED');
    });
  });

  it('caps Interview at 10 even for PREMIUM — the one deliberate non-unlimited exception', () => {
    const result = checkTestEligibility('IO', 'PREMIUM', { ...EMPTY_USAGE, interviewTestsUsed: 10 });
    expect(result.status).toBe('LIMIT_REACHED');
    const oneBelow = checkTestEligibility('IO', 'PREMIUM', { ...EMPTY_USAGE, interviewTestsUsed: 9 });
    expect(oneBelow.status).toBe('ELIGIBLE');
  });

  it('produces the same allow/deny decision across all tiers x all test types x quota states as the generated contract', () => {
    TestTypeValues.forEach((testType) => {
      SubscriptionTierValues.forEach((tier) => {
        const bucketKey = bucketKeyFor(testType);
        const bucket = SubscriptionLimits.find((l) => l.bucket === bucketKey)!;
        const limit = tier === 'FREE' ? bucket.free : tier === 'BASIC' ? bucket.basic : tier === 'PRO' ? bucket.pro : bucket.premium;

        const zeroUsage = checkTestEligibility(testType, tier, EMPTY_USAGE);
        if (limit === -1 || limit > 0) {
          expect(zeroUsage.status).toBe('ELIGIBLE');
        } else {
          expect(zeroUsage.status).toBe('LIMIT_REACHED');
        }

        if (limit > 0) {
          const atLimitUsage = { ...EMPTY_USAGE };
          const field = bucketKey === 'OIR' ? 'oirTestsUsed'
            : bucketKey === 'PPDT' ? 'ppdtTestsUsed'
            : bucketKey === 'PIQ' ? 'piqTestsUsed'
            : bucketKey === 'TAT' ? 'tatTestsUsed'
            : bucketKey === 'WAT' ? 'watTestsUsed'
            : bucketKey === 'SRT' ? 'srtTestsUsed'
            : bucketKey === 'SD' ? 'sdTestsUsed'
            : bucketKey === 'GTO' ? 'gtoTestsUsed'
            : 'interviewTestsUsed';
          atLimitUsage[field as keyof typeof atLimitUsage] = limit;
          expect(checkTestEligibility(testType, tier, atLimitUsage).status).toBe('LIMIT_REACHED');
        }
      });
    });
  });
});

/**
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): pins `currentPeriodKey` --
 * must stay byte-for-byte identical to KMP's `currentPeriodKey` (`CheckTestEligibilityUseCase`
 * package) and `functions/src/eligibility.js`'s `currentPeriodKey`, all three UTC-based.
 */
describe('currentPeriodKey', () => {
  it('FREE tier always uses the legacy calendar-month key regardless of startDate', () => {
    const startDate = Date.UTC(2026, 0, 25); // Jan 25, 2026
    expect(currentPeriodKey('FREE', startDate)).toBe(currentYearMonth());
  });

  it('null startDate falls back to the legacy calendar-month key', () => {
    expect(currentPeriodKey('PRO', null)).toBe(currentYearMonth());
  });

  it('paid tier resets on the anniversary day, not the 1st', () => {
    const startDate = Date.UTC(2026, 5, 25); // Jun 25, 2026
    const onOrAfterAnniversary = Date.UTC(2026, 7, 25); // Aug 25, 2026
    const beforeAnniversary = Date.UTC(2026, 7, 24); // Aug 24, 2026

    vi.useFakeTimers();
    try {
      vi.setSystemTime(onOrAfterAnniversary);
      expect(currentPeriodKey('PRO', startDate)).toBe('2026-08-25');

      vi.setSystemTime(beforeAnniversary);
      expect(currentPeriodKey('PRO', startDate)).toBe('2026-07-25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a day-31 anchor clamps to Feb 28 in a non-leap year', () => {
    const startDate = Date.UTC(2026, 0, 31); // Jan 31, 2026

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.UTC(2026, 1, 28)); // Feb 28, 2026
      expect(currentPeriodKey('PRO', startDate)).toBe('2026-02-28');
    } finally {
      vi.useRealTimers();
    }
  });
});
