import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubscriptionSupportViewModel } from '../../src/viewmodels/useSubscriptionSupportViewModel';
import type { SubscriptionSupportSnapshot } from '../../src/repositories/SupportRepository';
import type { SupportRepository } from '../../src/repositories/SupportRepository';

function mockRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getSubscriptionSupportSnapshot: vi.fn(),
    ...overrides
  } as unknown as SupportRepository;
}

const SNAPSHOT: SubscriptionSupportSnapshot = {
  userId: 'user-1',
  firestore: { tier: 'PREMIUM' },
  razorpay: null,
  revenueCat: { status: 'NONE' },
  alerts: { items: [], hasMore: false },
  conflict: null
};

/**
 * Phase 9 (Payment Ecosystem Hardening plan): pins the loading/loaded/error states a support
 * agent actually sees, and that a partial (some-sources-unavailable) snapshot still renders --
 * a support tool going blank because one of three sources degraded would defeat the point of the
 * callable's per-source `unavailable` marker.
 */
describe('useSubscriptionSupportViewModel', () => {
  it('starts IDLE and never calls the repository until lookup is invoked', () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    expect(result.current.state).toEqual({ status: 'IDLE' });
    expect(repository.getSubscriptionSupportSnapshot).not.toHaveBeenCalled();
  });

  it('transitions LOADING -> LOADED with the resolved snapshot on a successful lookup', async () => {
    const repository = mockRepository({
      getSubscriptionSupportSnapshot: vi.fn().mockResolvedValue(SNAPSHOT)
    });
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    act(() => result.current.lookup('user-1'));

    await waitFor(() => expect(result.current.state.status).toBe('LOADED'));
    expect(result.current.state).toEqual({ status: 'LOADED', snapshot: SNAPSHOT });
    expect(repository.getSubscriptionSupportSnapshot).toHaveBeenCalledWith('user-1');
  });

  it('transitions to ERROR carrying both the message and the code (e.g. functions/permission-denied) when the callable rejects', async () => {
    // Mirrors the real shape `firebase/functions`'s `httpsCallable` rejects with: `.code` is
    // `"functions/<error-code>"`, `.message` is the developer-supplied HttpsError text -- two
    // distinct fields, deliberately not conflated (see `SupportSubscriptionPage.test.tsx`'s doc
    // comment for the bug this pins).
    const error = Object.assign(new Error('Admin access required'), { code: 'functions/permission-denied' });
    const repository = mockRepository({
      getSubscriptionSupportSnapshot: vi.fn().mockRejectedValue(error)
    });
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    act(() => result.current.lookup('user-1'));

    await waitFor(() => expect(result.current.state.status).toBe('ERROR'));
    expect(result.current.state).toEqual({ status: 'ERROR', message: 'Admin access required', code: 'functions/permission-denied' });
  });

  it('still resolves to LOADED (not ERROR) when the snapshot is partial -- an unavailable source is embedded data, not a rejection', async () => {
    const partialSnapshot: SubscriptionSupportSnapshot = {
      userId: 'user-1',
      firestore: { tier: 'PREMIUM' },
      razorpay: { unavailable: true },
      revenueCat: { status: 'NONE' },
      alerts: { items: [], hasMore: false },
      conflict: null
    };
    const repository = mockRepository({
      getSubscriptionSupportSnapshot: vi.fn().mockResolvedValue(partialSnapshot)
    });
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    act(() => result.current.lookup('user-1'));

    await waitFor(() => expect(result.current.state.status).toBe('LOADED'));
    expect(result.current.state).toEqual({ status: 'LOADED', snapshot: partialSnapshot });
  });

  it('does not call the repository for a blank/whitespace-only uid (no wasted admin-callable invocation)', () => {
    const repository = mockRepository();
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    act(() => result.current.lookup('   '));

    expect(result.current.state).toEqual({ status: 'IDLE' });
    expect(repository.getSubscriptionSupportSnapshot).not.toHaveBeenCalled();
  });

  it('trims the uid before calling the repository', async () => {
    const repository = mockRepository({
      getSubscriptionSupportSnapshot: vi.fn().mockResolvedValue(SNAPSHOT)
    });
    const { result } = renderHook(() => useSubscriptionSupportViewModel(repository));

    act(() => result.current.lookup('  user-1  '));

    await waitFor(() => expect(result.current.state.status).toBe('LOADED'));
    expect(repository.getSubscriptionSupportSnapshot).toHaveBeenCalledWith('user-1');
  });
});
