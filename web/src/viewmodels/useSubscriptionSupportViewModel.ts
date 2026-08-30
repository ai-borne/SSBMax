import { useCallback, useState } from 'react';
import { SupportRepository, SubscriptionSupportSnapshot } from '../repositories/SupportRepository';

export type SupportSnapshotState =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | { status: 'LOADED'; snapshot: SubscriptionSupportSnapshot }
  | { status: 'ERROR'; message: string; code?: string };

/** `firebase/functions`'s `httpsCallable` rejects with a `FunctionsError` whose `.code` is
 * `"functions/<error-code>"` (e.g. `"functions/permission-denied"`) and whose `.message` is the
 * developer-supplied `HttpsError` message text -- distinct fields, never the same string. Reading
 * `.code` off an unknown rejection this way (rather than assuming an `Error` subclass) is what
 * lets the page distinguish "not an admin" from every other failure without string-matching the
 * message, which would silently never match. */
function extractCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : undefined;
}

export interface UseSubscriptionSupportViewModelReturn {
  state: SupportSnapshotState;
  lookup: (userId: string) => void;
}

/**
 * State-only ViewModel for `SupportSubscriptionPage.tsx` (Phase 9, Payment Ecosystem Hardening
 * plan) -- fetching logic lives entirely in `SupportRepository`, matching web/CLAUDE.md's
 * ViewModel rules. `lookup` is user-triggered (a support agent typing a uid and submitting), not
 * an on-mount effect -- there is no default user to look up.
 */
export function useSubscriptionSupportViewModel(
  injectedRepository?: SupportRepository
): UseSubscriptionSupportViewModelReturn {
  const [defaultRepository] = useState(() => new SupportRepository());
  const repository = injectedRepository ?? defaultRepository;
  const [state, setState] = useState<SupportSnapshotState>({ status: 'IDLE' });

  const lookup = useCallback(
    (userId: string) => {
      const trimmed = userId.trim();
      if (!trimmed) return;

      setState({ status: 'LOADING' });
      repository
        .getSubscriptionSupportSnapshot(trimmed)
        .then((snapshot) => setState({ status: 'LOADED', snapshot }))
        .catch((error: unknown) =>
          setState({
            status: 'ERROR',
            message: error instanceof Error ? error.message : 'Lookup failed',
            code: extractCode(error)
          })
        );
    },
    [repository]
  );

  return { state, lookup };
}
