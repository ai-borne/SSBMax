import { useCallback, useEffect, useState } from 'react';
import { AccountRepository } from '../repositories/AccountRepository';
import { strings } from '../constants/strings';

export interface AccountDeletionState {
  deletionRequestedAt: number | null;
  isModalOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export interface AccountDeletionActions {
  openModal: () => void;
  closeModal: () => void;
  /** Resolves true once the request succeeded, so the caller can sign the user out. */
  confirmDelete: () => Promise<boolean>;
  cancelDeletion: () => Promise<void>;
}

/**
 * Orchestrates the delete-account flow's UI state (docs/plans/AccountDeletion.md Phase 3).
 * Follows `useUserProfileViewModel`'s pattern: a lazy-initialized repository singleton and a
 * `cancelled` guard on the load effect. The Firestore status read (`getDeletionStatus`) is
 * refreshed after every successful write so `AccountSection`'s pending banner never goes stale.
 */
export function useAccountDeletionViewModel(
  userId: string | undefined,
  injectedRepository?: AccountRepository
): AccountDeletionState & AccountDeletionActions {
  const [repository] = useState(() => injectedRepository ?? new AccountRepository());
  const [state, setState] = useState<AccountDeletionState>({
    deletionRequestedAt: null,
    isModalOpen: false,
    isSubmitting: false,
    error: null,
  });

  const loadStatus = useCallback(
    async (cancelledRef: { cancelled: boolean }) => {
      if (!userId) {
        setState((prev) => ({ ...prev, deletionRequestedAt: null }));
        return;
      }
      const status = await repository.getDeletionStatus(userId);
      if (cancelledRef.cancelled) return;
      setState((prev) => ({ ...prev, deletionRequestedAt: status.deletionRequestedAt }));
    },
    [userId, repository]
  );

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    loadStatus(cancelledRef);
    return () => {
      cancelledRef.cancelled = true;
    };
  }, [loadStatus]);

  const openModal = useCallback(() => setState((prev) => ({ ...prev, isModalOpen: true, error: null })), []);
  const closeModal = useCallback(
    () => setState((prev) => ({ ...prev, isModalOpen: false, isSubmitting: false, error: null })),
    []
  );

  const confirmDelete = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await repository.requestAccountDeletion();
      setState((prev) => ({ ...prev, isSubmitting: false, isModalOpen: false }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : strings.account.deleteAccountFailed,
      }));
      return false;
    }
  }, [repository]);

  const cancelDeletion = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await repository.cancelAccountDeletion();
      setState((prev) => ({ ...prev, isSubmitting: false, deletionRequestedAt: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : strings.account.cancelDeletionFailed,
      }));
    }
  }, [repository]);

  return { ...state, openModal, closeModal, confirmDelete, cancelDeletion };
}
