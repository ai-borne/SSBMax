/**
 * Mirrors `functions/src/account/purgeExpiredAccounts.js`'s `GRACE_PERIOD_DAYS`. There is no
 * generated contract for this value (it isn't a Firestore path/enum/limit), so it must be kept
 * in sync by hand -- change both together, per docs/plans/AccountDeletion.md.
 */
export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 7;
