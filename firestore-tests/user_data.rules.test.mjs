// Rules-unit coverage for users/{userId}/data/{document} in ../firestore.rules.
//
// C1 (Payment Ecosystem Hardening, Phase 1): Firestore evaluates security rules ADDITIVELY --
// a request is allowed if ANY matching rule allows it, and a later, more specific `match` block
// can only ever GRANT more, never take away. So the `match /data/subscription` block's
// `allow write: if false` was purely decorative: the enclosing `match /data/{document}` block's
// `allow read, write: if isOwner(userId)` already matched the same document and already allowed
// the write. Any signed-in user could therefore set `tier: 'PREMIUM'` on their own subscription
// doc and grant themselves a paid plan for free.
//
// The fix narrows the broad rule (`document != 'subscription'`) rather than tightening the
// specific one, because tightening a specific block cannot revoke a broad grant. This file pins
// both halves of that: subscription is unwritable, and `profile` -- which IS legitimately
// client-written (GitLiveUserProfileRepository) -- still is.
//
// Run via `firebase emulators:exec --only firestore "npm --prefix firestore-tests test"` --
// requires the emulator listening on 127.0.0.1:8080 (see ../firebase.json).

import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.RULES_TEST_PROJECT_ID || 'demo-ssbmax-rules-test',
    firestore: {
      rules: readFileSync('../firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** Mirrors SubscriptionTierDto's persisted shape (shared/.../data/repository/SubscriptionDtos.kt). */
function subscriptionDoc(overrides = {}) {
  return {
    tier: 'PREMIUM',
    source: 'RAZORPAY',
    startDate: Date.now(),
    expiryDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    willRenew: true,
    ...overrides
  };
}

function seedSubscription(userId = 'user-1', overrides = {}) {
  return testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc(userId).collection('data')
      .doc('subscription').set(subscriptionDoc(overrides));
  });
}

test('a client cannot create their own subscription doc, even a well-formed one', async () => {
  // The doc's absence is not a defense: the exploit works just as well by creating it from
  // scratch on a user who has never paid.
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertFails(
    db.collection('users').doc('user-1').collection('data').doc('subscription')
      .set(subscriptionDoc())
  );
});

test('a client cannot update tier on their own subscription doc (the C1 privilege-escalation exploit)', async () => {
  // This is the finding verbatim: a normal signed-in user promoting themselves to PREMIUM with
  // a single client-SDK write, no payment involved.
  const db = testEnv.authenticatedContext('user-1').firestore();
  await seedSubscription('user-1', { tier: 'FREE', source: null, expiryDate: null });

  await assertFails(
    db.collection('users').doc('user-1').collection('data').doc('subscription')
      .update({ tier: 'PREMIUM' })
  );
});

test('a client cannot update expiryDate on their own subscription doc', async () => {
  // Extending expiry is the same escalation by another route -- it keeps a lapsed paid tier
  // alive indefinitely against the read-time expiry derivation.
  const db = testEnv.authenticatedContext('user-1').firestore();
  await seedSubscription('user-1');

  await assertFails(
    db.collection('users').doc('user-1').collection('data').doc('subscription')
      .update({ expiryDate: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000 })
  );
});

test('a user can still read their own subscription doc', async () => {
  // The lockdown is write-only: every client tier read (GitLiveSubscriptionRepository) goes
  // through this path and must keep working.
  const db = testEnv.authenticatedContext('user-1').firestore();
  await seedSubscription('user-1');

  await assertSucceeds(
    db.collection('users').doc('user-1').collection('data').doc('subscription').get()
  );
});

test('a user can still write their own profile doc (the narrowing must not break profile saves)', async () => {
  // users/{uid}/data/profile is legitimately client-written (GitLiveUserProfileRepository).
  // Narrowing /data/{document} to exclude only `subscription` must leave this untouched --
  // making the whole subcollection read-only would break every profile save in the app.
  const db = testEnv.authenticatedContext('user-1').firestore();

  await assertSucceeds(
    db.collection('users').doc('user-1').collection('data').doc('profile')
      .set({ userId: 'user-1', name: 'Test Candidate', email: 'candidate@example.com' })
  );
});

test('another user cannot read or write someone else\'s subscription doc', async () => {
  const db = testEnv.authenticatedContext('user-2').firestore();
  await seedSubscription('user-1');

  await assertFails(
    db.collection('users').doc('user-1').collection('data').doc('subscription').get()
  );
  await assertFails(
    db.collection('users').doc('user-1').collection('data').doc('subscription')
      .update({ tier: 'PREMIUM' })
  );
});
