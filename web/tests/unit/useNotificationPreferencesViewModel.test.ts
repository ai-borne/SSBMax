import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotificationPreferencesViewModel } from '../../src/viewmodels/useNotificationPreferencesViewModel';
import { defaultNotificationPreferences } from '../../src/types/notification';
import type { NotificationRepository } from '../../src/repositories/NotificationRepository';

function mockRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getPreferences: vi.fn().mockResolvedValue(defaultNotificationPreferences('user_1')),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as NotificationRepository;
}

describe('useNotificationPreferencesViewModel', () => {
  it('loads preferences for the given user on mount', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationPreferencesViewModel('user_1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(repository.getPreferences).toHaveBeenCalledWith('user_1');
    expect(result.current.preferences?.userId).toBe('user_1');
  });

  it('does not attempt a Firestore read when no user is signed in, matching guest/unauthenticated behavior elsewhere', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationPreferencesViewModel(undefined, repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(repository.getPreferences).not.toHaveBeenCalled();
    expect(result.current.preferences).toBeNull();
  });

  it('persists enablePushNotifications via savePreferences, keeping the rest of the doc intact', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationPreferencesViewModel('user_1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.setEnablePushNotifications(false);
    });

    expect(repository.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', enablePushNotifications: false })
    );
  });

  it('persists enableTestReminders via savePreferences, keeping the rest of the doc intact', async () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useNotificationPreferencesViewModel('user_1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.setEnableTestReminders(false);
    });

    expect(repository.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', enableTestReminders: false })
    );
  });

  it('optimistically updates preferences before the save resolves', async () => {
    let resolveSave: () => void = () => {};
    const repository = mockRepository({
      savePreferences: vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve; }))
    });
    const { result } = renderHook(() => useNotificationPreferencesViewModel('user_1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      void result.current.setEnableTestReminders(false);
    });

    await waitFor(() => expect(result.current.preferences?.enableTestReminders).toBe(false));
    resolveSave();
  });

  it('rolls back to the previous preferences when savePreferences rejects', async () => {
    const repository = mockRepository({
      savePreferences: vi.fn().mockRejectedValue(new Error('offline'))
    });
    const { result } = renderHook(() => useNotificationPreferencesViewModel('user_1', repository));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const previousValue = result.current.preferences?.enableTestReminders;

    await act(async () => {
      await result.current.setEnableTestReminders(!previousValue);
    });

    expect(result.current.preferences?.enableTestReminders).toBe(previousValue);
    expect(result.current.error).toBe('offline');
  });
});
