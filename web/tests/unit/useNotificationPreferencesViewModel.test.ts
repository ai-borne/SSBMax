import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotificationPreferencesViewModel } from '../../src/viewmodels/useNotificationPreferencesViewModel';
import { defaultNotificationPreferences } from '../../src/types/notification';

function mockRepository(overrides: Partial<Record<string, any>> = {}) {
  return {
    getPreferences: vi.fn().mockResolvedValue(defaultNotificationPreferences('user_1')),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as any;
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
});
