import { describe, it, expect, vi } from 'vitest';
import { AccountRepository } from '../../src/repositories/AccountRepository';
import { httpsCallable, HttpsCallable } from 'firebase/functions';
import { getDoc, DocumentSnapshot } from 'firebase/firestore';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {},
  db: {}
}));

/**
 * docs/plans/AccountDeletion.md Phase 3: pins the callable names the delete-account flow
 * depends on -- a wrong callable name here would only surface in production as a live
 * "not-found", same rationale as `SupportRepository.test.ts`.
 */
describe('AccountRepository', () => {
  it('requestAccountDeletion invokes the requestAccountDeletion callable with no payload', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { success: true } });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    await new AccountRepository().requestAccountDeletion();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'requestAccountDeletion');
    expect(callable).toHaveBeenCalledWith();
  });

  it('cancelAccountDeletion invokes the cancelAccountDeletion callable with no payload', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { success: true } });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    await new AccountRepository().cancelAccountDeletion();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'cancelAccountDeletion');
    expect(callable).toHaveBeenCalledWith();
  });

  it('getDeletionStatus reads deletionRequestedAt off the users/{userId} doc as millis', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ deletionRequestedAt: { toMillis: () => 12345 } })
    } as unknown as DocumentSnapshot);

    const status = await new AccountRepository().getDeletionStatus('user-1');

    expect(status).toEqual({ deletionRequestedAt: 12345 });
  });

  it('getDeletionStatus returns null when no deletion is pending', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({})
    } as unknown as DocumentSnapshot);

    const status = await new AccountRepository().getDeletionStatus('user-1');

    expect(status).toEqual({ deletionRequestedAt: null });
  });
});
