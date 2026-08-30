/**
 * Account Repository
 * Single Responsibility: the delete-account flow's client entry point (docs/plans/AccountDeletion.md).
 * Writes (`requestAccountDeletion` / `cancelAccountDeletion`) go through the Cloud Functions
 * callables in `functions/src/account/` -- that module is the sole cascade-delete authority
 * (root CLAUDE.md's four-consumer SSOT section), so this repository never touches the cascade
 * collections itself, mirroring `SupportRepository.ts`'s callable-only shape. The one read
 * (`getDeletionStatus`) goes straight to Firestore via the client SDK, same as
 * `UserProfileRepository` -- `firestore.rules` already grants `allow read: if isOwner(userId)`
 * on `users/{userId}`, so no callable is needed just to display the pending-deletion banner.
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions as defaultFunctions, db as defaultDb } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import { Firestore } from 'firebase/firestore';

export interface AccountDeletionStatus {
  /** Epoch millis, or null when no deletion is pending. */
  deletionRequestedAt: number | null;
}

export class AccountRepository {
  constructor(
    private readonly functionsInstance: Functions = defaultFunctions,
    private readonly firestore: Firestore = defaultDb
  ) {}

  requestAccountDeletion = (): Promise<void> =>
    httpsCallable(this.functionsInstance, 'requestAccountDeletion')().then(() => undefined);

  cancelAccountDeletion = (): Promise<void> =>
    httpsCallable(this.functionsInstance, 'cancelAccountDeletion')().then(() => undefined);

  getDeletionStatus = async (userId: string): Promise<AccountDeletionStatus> => {
    const snap = await getDoc(doc(this.firestore, FirestorePaths.USERS, userId));
    const requestedAt = snap.exists() ? snap.data().deletionRequestedAt : null;
    return { deletionRequestedAt: requestedAt?.toMillis?.() ?? null };
  };
}
