import { useCallback, useEffect, useState } from 'react';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import { UserProfile } from '../types/userProfile';

export interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

export interface UserProfileActions {
  refresh: () => void;
}

/**
 * Loads `users/{userId}/data/profile` -- the same KMP-shared `UserProfile` document --
 * for display in Settings. Following `useOLQDashboardViewModel`'s pattern: a
 * lazy-initialized repository singleton (avoids a fresh instance on every render)
 * and a `cancelled` guard on the async fetch.
 */
export function useUserProfileViewModel(
  userId: string | undefined,
  injectedRepository?: UserProfileRepository
): UserProfileState & UserProfileActions {
  const [state, setState] = useState<UserProfileState>({ profile: null, isLoading: true, error: null });
  const [defaultRepository] = useState(() => new UserProfileRepository());
  const repository = injectedRepository ?? defaultRepository;
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!userId) {
      // Standard guard-clause reset: not derivable at render time since it depends on the
      // previous state (isLoading must be flipped back to false).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ profile: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    (async () => {
      try {
        const profile = await repository.getUserProfile(userId);
        if (cancelled) return;
        setState({ profile, isLoading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({ profile: null, isLoading: false, error: error instanceof Error ? error.message : 'Failed to load profile' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, repository, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  return { ...state, refresh };
}
