import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAccountDeletionViewModel } from '../../src/viewmodels/useAccountDeletionViewModel';

/**
 * docs/plans/AccountDeletion.md Phase 3: encodes the irreversibility guard -- opening the
 * confirmation modal must never call the delete callable on its own, only an explicit
 * `confirmDelete()` may, and `cancelDeletion()` must call the distinct cancel callable rather
 * than reusing/skipping a network call.
 */
describe('useAccountDeletionViewModel', () => {
  const makeRepository = (deletionRequestedAt: number | null = null) => ({
    getDeletionStatus: vi.fn().mockResolvedValue({ deletionRequestedAt }),
    requestAccountDeletion: vi.fn().mockResolvedValue(undefined),
    cancelAccountDeletion: vi.fn().mockResolvedValue(undefined)
  });

  it('loads deletion status for the signed-in user', async () => {
    const repository = makeRepository(999);
    const { result } = renderHook(() => useAccountDeletionViewModel('user-1', repository as any));

    await waitFor(() => expect(result.current.deletionRequestedAt).toBe(999));
    expect(repository.getDeletionStatus).toHaveBeenCalledWith('user-1');
  });

  it('opening the confirmation modal does not call requestAccountDeletion', async () => {
    const repository = makeRepository();
    const { result } = renderHook(() => useAccountDeletionViewModel('user-1', repository as any));
    await waitFor(() => expect(repository.getDeletionStatus).toHaveBeenCalled());

    act(() => result.current.openModal());

    expect(result.current.isModalOpen).toBe(true);
    expect(repository.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it('confirmDelete calls requestAccountDeletion and resolves true on success', async () => {
    const repository = makeRepository();
    const { result } = renderHook(() => useAccountDeletionViewModel('user-1', repository as any));

    let succeeded: boolean = false;
    await act(async () => {
      succeeded = await result.current.confirmDelete();
    });

    expect(repository.requestAccountDeletion).toHaveBeenCalledTimes(1);
    expect(succeeded).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
  });

  it('cancelDeletion calls cancelAccountDeletion, not requestAccountDeletion', async () => {
    const repository = makeRepository(999);
    const { result } = renderHook(() => useAccountDeletionViewModel('user-1', repository as any));
    await waitFor(() => expect(result.current.deletionRequestedAt).toBe(999));

    await act(async () => {
      await result.current.cancelDeletion();
    });

    expect(repository.cancelAccountDeletion).toHaveBeenCalledTimes(1);
    expect(repository.requestAccountDeletion).not.toHaveBeenCalled();
    expect(result.current.deletionRequestedAt).toBeNull();
  });

  it('surfaces an error message and leaves the modal open when confirmDelete fails', async () => {
    const repository = makeRepository();
    repository.requestAccountDeletion.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAccountDeletionViewModel('user-1', repository as any));

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(result.current.error).toBe('boom');
  });
});
