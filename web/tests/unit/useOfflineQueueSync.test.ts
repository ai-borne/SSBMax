import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Mocked } from 'vitest';
import { useOfflineQueueSync } from '../../src/hooks/useOfflineQueueSync';
import type { OfflineQueueService } from '../../src/services/OfflineQueueService';
import type { SubmissionService } from '../../src/services/SubmissionService';
import type { EligibilityService } from '../../src/services/EligibilityService';

const mockUseFeatureFlag = vi.fn((_flagKey: string) => true);
vi.mock('../../src/viewmodels/useFeatureFlag', () => ({
  useFeatureFlag: (flagKey: string) => mockUseFeatureFlag(flagKey)
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true });
}

function mockOfflineQueue(overrides: Partial<Record<keyof OfflineQueueService, unknown>> = {}): Mocked<OfflineQueueService> {
  return {
    syncPendingSubmissions: vi.fn().mockResolvedValue({ syncedCount: 2, failedCount: 0, tamperedCount: 0, authRequired: false }),
    ...overrides
  } as unknown as Mocked<OfflineQueueService>;
}

const submissionService = {} as SubmissionService;
const eligibilityService = {} as EligibilityService;

describe('useOfflineQueueSync', () => {
  beforeEach(() => {
    mockUseFeatureFlag.mockReturnValue(true);
  });

  afterEach(() => {
    setOnline(true);
  });

  it('syncs once on mount when already online, flag enabled, and userId set -- covers the common cold-load-while-online path', async () => {
    setOnline(true);
    const offlineQueue = mockOfflineQueue();

    const { result } = renderHook(() => useOfflineQueueSync('user-1', offlineQueue, submissionService, eligibilityService));

    await waitFor(() => expect(result.current).toEqual({ syncedCount: 2, failedCount: 0, tamperedCount: 0 }));
    expect(offlineQueue.syncPendingSubmissions).toHaveBeenCalledTimes(1);
  });

  it('does not sync while offline, then syncs once the "online" event fires', async () => {
    setOnline(false);
    const offlineQueue = mockOfflineQueue();

    const { result } = renderHook(() => useOfflineQueueSync('user-1', offlineQueue, submissionService, eligibilityService));

    expect(offlineQueue.syncPendingSubmissions).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(offlineQueue.syncPendingSubmissions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({ syncedCount: 2, failedCount: 0, tamperedCount: 0 }));
  });

  it('resyncs again on a second reconnect after dropping offline in between', async () => {
    setOnline(true);
    const offlineQueue = mockOfflineQueue();

    renderHook(() => useOfflineQueueSync('user-1', offlineQueue, submissionService, eligibilityService));
    await waitFor(() => expect(offlineQueue.syncPendingSubmissions).toHaveBeenCalledTimes(1));

    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(offlineQueue.syncPendingSubmissions).toHaveBeenCalledTimes(2));
  });

  it('never syncs when offline_resync_enabled is false, even when online with a userId', async () => {
    mockUseFeatureFlag.mockReturnValue(false);
    setOnline(true);
    const offlineQueue = mockOfflineQueue();

    renderHook(() => useOfflineQueueSync('user-1', offlineQueue, submissionService, eligibilityService));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(offlineQueue.syncPendingSubmissions).not.toHaveBeenCalled();
  });

  it('never syncs when userId is unset, even when online with the flag enabled -- avoids flushing an anonymous/no-op queue', async () => {
    setOnline(true);
    const offlineQueue = mockOfflineQueue();

    renderHook(() => useOfflineQueueSync(undefined, offlineQueue, submissionService, eligibilityService));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(offlineQueue.syncPendingSubmissions).not.toHaveBeenCalled();
  });

  it('syncs once userId becomes available after mount -- covers auth resolving just after the initial online check', async () => {
    setOnline(true);
    const offlineQueue = mockOfflineQueue();

    const { result, rerender } = renderHook<ReturnType<typeof useOfflineQueueSync>, { userId?: string }>(
      ({ userId }) => useOfflineQueueSync(userId, offlineQueue, submissionService, eligibilityService),
      { initialProps: { userId: undefined } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(offlineQueue.syncPendingSubmissions).not.toHaveBeenCalled();

    rerender({ userId: 'user-1' });

    await waitFor(() => expect(offlineQueue.syncPendingSubmissions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({ syncedCount: 2, failedCount: 0, tamperedCount: 0 }));
  });
});
