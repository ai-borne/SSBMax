import { useCallback, useEffect, useState } from 'react';
import { SubscriptionRepository, currentYearMonth } from '../repositories/SubscriptionRepository';
import { checkTestEligibility, EMPTY_USAGE, SubscriptionUsage, TestEligibility } from '../domain/subscriptionEligibility';
import { SubscriptionTier, TestType } from '../generated/contracts';
import { DevTierOverride } from '../constants/ssbSelectionProcess';

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
      setRealTier('FREE');
      setUsage(EMPTY_USAGE);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const month = currentYearMonth();
    Promise.all([repository.getTier(userId), repository.getMonthlyUsage(userId, month)]).then(([fetchedTier, fetchedUsage]) => {
      if (!isMounted) return;
      setRealTier(fetchedTier);
      setUsage(fetchedUsage);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [userId, repository]);

  const overrideTier: SubscriptionTier | null = import.meta.env.DEV
    ? devOverride === 'FORCE_FREE'
      ? 'FREE'
      : devOverride === 'FORCE_PRO'
      ? 'PRO'
      : devOverride === 'FORCE_PREMIUM'
      ? 'PREMIUM'
      : null
    : null;
  const tier = overrideTier ?? realTier;

  const checkEligibility = useCallback((testType: TestType) => checkTestEligibility(testType, tier, usage), [tier, usage]);

  return { tier, usage, isLoading, checkEligibility };
}
