package com.ssbmax.shared.domain.model

/**
 * Mirrors `functions/src/account/purgeExpiredAccounts.js`'s `GRACE_PERIOD_DAYS` and
 * `web/src/constants/accountDeletion.ts`'s `ACCOUNT_DELETION_GRACE_PERIOD_DAYS`. There is no
 * mechanical cross-language enforcement for this Tier-2 copy constant (root `CLAUDE.md`'s
 * four-consumer SSOT section) -- keep all three in sync by hand if the grace period changes.
 */
const val ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 7
