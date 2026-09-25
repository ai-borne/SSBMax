import { useEffect, useState } from 'react';
import { SubscriptionRepository, SubscriptionOwnership } from '../repositories/SubscriptionRepository';

const EMPTY_OWNERSHIP: SubscriptionOwnership = { source: null, expiryDate: null, willRenew: true };

/**
 * Loads the entitlement doc's renewal fields (`expiryDate`/`willRenew`) for the read-only
 * `SubscriptionPage` -- see `SubscriptionRepository.getOwnership`.
 */
export function useSubscriptionOwnership(
  userId: string | undefined,
  repository: SubscriptionRepository = new SubscriptionRepository()
): SubscriptionOwnership {
  const [ownership, setOwnership] = useState<SubscriptionOwnership>(EMPTY_OWNERSHIP);

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      // Standard guard-clause reset: not derivable at render time since it depends on the
      // previous ownership value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
