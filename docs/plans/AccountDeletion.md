# Account Deletion — SSOT & Status

**Status:** Phases 1–5 complete (functions, shared/KMP contract, web, Android/iOS wiring, docs).
**Owner:** sunilpawar
**Plan:** `/Users/sunil/.claude/plans/replicated-popping-iverson.md` (execution plan; this file is
the durable reference the plan's Phase 5 asks for, styled like
`docs/plans/TestFlowParity_Tier2Evaluation_SSOT.md`).

---

## 1. The SSOT rule

`functions/src/account/cascadeDelete.js` is the **sole** cascade-delete authority, per root
`CLAUDE.md`'s four-consumer SSOT section. Every collection an account can leave data in is
deleted there, and nowhere else. KMP (`shared`) and web never run cascade logic themselves —
they only call `requestAccountDeletion` / `cancelAccountDeletion`, both thin `https.onCall`
wrappers registered in `functions/src/index.js` alongside the scheduled `purgeExpiredAccounts`.

**Flow:** confirm in UI → `requestAccountDeletion` sets `users/{uid}.deletionRequestedAt`
(server timestamp) and disables the Auth account → grace period → either `cancelAccountDeletion`
(re-enables Auth, clears the field) or, once the grace period elapses, the daily
`purgeExpiredAccounts` schedule runs the full cascade and deletes the Auth account **last**
(after Firestore cascade succeeds, so a partial failure can never strand an already-deleted
Auth account).

**Grace period:** `GRACE_PERIOD_DAYS = 7` (`functions/src/account/purgeExpiredAccounts.js:18`) —
the one place this number is defined; UI copy on web reads it from
`web/src/constants/strings/` rather than hardcoding it, so it can't drift.

---

## 2. Cascade table (as implemented, `functions/src/account/cascadeDelete.js`)

| Collection/path | Action | Notes |
|---|---|---|
| `submissions`, `archived_submissions` | delete, `.where('userId','==',uid)`, batched (450/batch) | |
| `interview_sessions`, `interview_responses`, `interview_results`, `interview_questions` | delete, `.where('userId','==',uid)`, batched | |
| `gto_results`, `ppdt_results`, `psych_results` | delete, `.where('userId','==',uid)`, batched | `psych_results`'s `userId` field confirmed present during Phase 1 |
| `notifications`, `fcmTokens` | delete, `.where('userId','==',uid)`, batched | top-level collections, not subcollections |
| `question_usage`, `study_progress`, `study_sessions`, `user_progress`, `test_sessions` | delete, `.where('userId','==',uid)`, batched | |
| `notificationPreferences` | delete, single doc `doc(uid)` | keyed by uid directly, not a `userId`-field query — confirmed via `web/src/repositories/NotificationRepository.ts` |
| `users/{uid}` + subcollections (`data/profile`, `subscription/*`) | `db.recursiveDelete(userRef)`, last | Firestore/Auth ordering: Firestore cascade completes before `admin.auth().deleteUser(uid)` |
| Cloud Storage user files | **no-op, confirmed** | grep of `iosApp/` and `data-firebase/src/iosMain` for an upload path found none |
| `payments`, `webhook_logs`, `ops_alerts` | **retained, untouched** | product decision — financial/audit trail survives account deletion |

`deleteQueryBatch` (same file) is the generic paginated batch-delete helper written for this —
no reusable one existed pre-Phase-1.

---

## 3. Per-platform entry points

- **`functions`**: `requestAccountDeletion.js`, `cancelAccountDeletion.js`,
  `purgeExpiredAccounts.js` (scheduled daily), `cascadeDelete.js` (shared helper). Tests:
  `functions/test/account/accountDeletion.test.js`, `cascadeDelete.test.js` — 12/12 green.
- **`shared` (Android + iOS, one implementation, no fork)**:
  `AuthRepository.requestAccountDeletion()` / `.cancelAccountDeletion()` (interface), implemented
  in `data-firebase` via `Firebase.functions.httpsCallable(...)`; `RequestAccountDeletionUseCase`
  / `CancelAccountDeletionUseCase` mirror `SignOutUseCase`'s trivial delegation shape;
  `AuthViewModel` owns `AccountDeletionState` (`Idle` / `ConfirmPending` / `Loading` /
  `DeletionPending` / `Error`), seeded from the reactive `currentUser` flow so
  `deletionRequestedAt` survives process death; `AccountDeletionDialogs.kt` renders the
  confirmation + pending-state UI; wired into `SSBMaxAppScaffold.kt`'s drawer next to sign-out —
  rendered identically on both platforms since there is no native SwiftUI fork.
- **`web`**: `AccountRepository.ts` (`requestAccountDeletion` / `cancelAccountDeletion` via
  `httpsCallable`), threaded through `AccountSection.tsx` → `AccountPage.tsx` /
  `SettingsPage.tsx` the same way `onSignOut` is threaded today; deletion-pending state renders
  from the existing user-profile read path with a cancel action.

---

## 4. Known, tracked-but-not-fixed debt

- `SSBMaxAppScaffold.kt` (~line 156, pre-existing) calls `authRepository.signOut()` directly,
  bypassing `SignOutUseCase` — flagged in Phase 2, not fixed as part of this plan (out of scope;
  separate follow-up).

## 5. Phase changelog

- **Phase 1** (`b7856ef1`) — server-authoritative cascade in `functions/src/account/`.
- **Phase 2** (`4bf8fc01`) — `AuthRepository`/`AuthViewModel` contract in `shared`.
- **Phase 3** (`67151340`) — web account-deletion flow.
- **Phase 4** (`dcf833e0`, `b5c1072d`) — Delete Account wired into the shared drawer for
  Android/iOS; deletion-pending state persisted and sign-out routed through its use case.
- **Phase 5** (this doc) — SSOT doc, deep-check, tech-debt sweep.
