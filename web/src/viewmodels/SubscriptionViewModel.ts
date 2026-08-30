import { useCallback, useEffect, useState } from 'react';
import { SubscriptionRepository } from '../repositories/SubscriptionRepository';
import { checkTestEligibility, currentPeriodKey, EMPTY_USAGE, SubscriptionUsage, TestEligibility } from '../domain/subscriptionEligibility';
import { SubscriptionTier, TestType } from '../generated/contracts';
import { DevTierOverride, getEffectiveTier } from '../constants/ssbSelectionProcess';

export interface UseSubscriptionViewModelReturn {
  tier: SubscriptionTier;
  usage: SubscriptionUsage;
  isLoading: boolean;
  checkEligibility: (testType: TestType) => TestEligibility;
}

/**
 * Web port of `CheckTestEligibilityUseCase` wiring (docs/plans/CrossPlatform_SSOT Phase 4).
 * The dev override changes only what this hook *reads* — real tier/usage are always fetched
 * from Firestore, matching the KMP fail-safe documented in claude.local.md (toggling back to
 * Follow Real never leaves a candidate limit-locked from real usage that happened during test).
 */
export function useSubscriptionViewModel(
  userId: string | undefined,
  devOverride: DevTierOverride = 'FOLLOW_REAL',
  repository: SubscriptionRepository = new SubscriptionRepository()
): UseSubscriptionViewModelReturn {
  const [realTier, setRealTier] = useState<SubscriptionTier>('FREE');
  const [usage, setUsage] = useState<SubscriptionUsage>(EMPTY_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      // Resetting to defaults when userId is cleared, and flipping isLoading back to true
      // to start a new fetch below, are both standard fetch-on-dependency-change resets --
      // not derivable at render time since they depend on the previous state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRealTier('FREE');
      setUsage(EMPTY_USAGE);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Sequential, not Promise.all: the period key (Phase 3 billing-anniversary reset) depends on
    // tier + startDate, so usage can't be fetched until both are known.
    (async () => {
      const [fetchedTier, startDate] = await Promise.all([repository.getTier(userId), repository.getStartDate(userId)]);
      const period = currentPeriodKey(fetchedTier, startDate);
      const fetchedUsage = await repository.getMonthlyUsage(userId, period);
      if (!isMounted) return;
      setRealTier(fetchedTier);
      setUsage(fetchedUsage);
      setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [userId, repository]);

  // getEffectiveTier is the same lookup PaymentRibbon/SubscriptionPage use for the dev-override
  // tier -- this hook previously duplicated it as a local ternary that never got a FORCE_BASIC
  // case added in Phase 2, so a dev override to BASIC silently fell through to the real tier here.
  const tier: SubscriptionTier = import.meta.env.DEV ? getEffectiveTier(devOverride, realTier) : realTier;

  const checkEligibility = useCallback((testType: TestType) => checkTestEligibility(testType, tier, usage), [tier, usage]);

  return { tier, usage, isLoading, checkEligibility };
}
