import { useEffect, useState } from 'react';
import { SubscriptionRepository, SubscriptionOwnership } from '../repositories/SubscriptionRepository';

const EMPTY_OWNERSHIP: SubscriptionOwnership = { source: null, expiryDate: null, willRenew: true };

/**
 * Web port of `UpgradeViewModel.kt`'s ownership load (Phase 4 amendment, dual-purchase gate) --
 * see `SubscriptionRepository.getOwnership`'s doc comment for why this exists.
 */
export function useSubscriptionOwnership(
  userId: string | undefined,
  repository: SubscriptionRepository = new SubscriptionRepository()
): SubscriptionOwnership {
  const [ownership, setOwnership] = useState<SubscriptionOwnership>(EMPTY_OWNERSHIP);

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setOwnership(EMPTY_OWNERSHIP);
      return;
    }
    repository.getOwnership(userId).then((result) => {
      if (isMounted) setOwnership(result);
    });
    return () => {
      isMounted = false;
    };
  }, [userId, repository]);

  return ownership;
}

/** RevenueCat webhook's `source` value (`functions/src/revenueCatWebhook.js`) -- the mobile path. */
export const MOBILE_PAYMENT_SOURCE = 'REVENUECAT';

export function isActiveMobileSubscription(ownership: SubscriptionOwnership, nowMillis: number = Date.now()): boolean {
  return ownership.source === MOBILE_PAYMENT_SOURCE && (ownership.expiryDate === null || ownership.expiryDate > nowMillis);
}
