/**
 * RevenueCat TRANSFER event handling (L3, Payment Ecosystem Hardening plan Phase 12).
 *
 * RC sends TRANSFER when an entitlement moves from one app_user_id to another (Play Family
 * Library sharing being withdrawn, an account merge, a support-initiated transfer in the RC
 * dashboard). Structurally different from every other event this webhook handles: it names OTHER
 * users via `transferred_from`/`transferred_to` arrays rather than acting on just
 * `event.app_user_id`, so it needs its own transaction shape instead of the generic single-doc
 * grant/revoke path in `revenueCatWebhook.js`.
 *
 * Scope (deliberately conservative): this only revokes the ORIGINAL owner(s)
 * (`transferred_from`) -- the defect this closes is stated exactly as "today the original user
 * keeps their tier forever". It does not also grant `transferred_to`, because RC's real transfer
 * flows already deliver the new owner their own grant-shaped event (an INITIAL_PURCHASE/RENEWAL
 * tied to their own purchase/restore) through the normal path -- writing a second, speculative
 * grant here risks a duplicate/incorrect write racing that event. Revoking the old owner is safe
 * unconditionally: whatever they had, they no longer own it.
 */

const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');

/**
 * Applies a TRANSFER event: downgrades every `transferred_from` uid's subscription doc to FREE,
 * but only when it's still RevenueCat-sourced -- an old owner whose doc was since overwritten by
 * a Razorpay purchase (or already reconciled to FREE by something else) must not be touched, same
 * "don't clobber a doc you don't own" stance `resolveReconciliation` takes everywhere else.
 */
async function processRevenueCatTransferEvent(event, firestoreDb) {
  const eventId = event.id;
  const transferredFrom = Array.isArray(event.transferred_from) ? event.transferred_from : [];

  const logRef = firestoreDb.collection(FirestorePaths.WEBHOOK_LOGS).doc(`rc_${eventId}`);

  return firestoreDb.runTransaction(async (transaction) => {
    const logDoc = await transaction.get(logRef);
    if (logDoc.exists) {
      return { idempotent: true };
    }

    const targets = transferredFrom.map((uid) => ({
      uid,
      subscriptionRef: firestoreDb
        .collection(FirestorePaths.USERS)
        .doc(uid)
        .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
        .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
    }));

    // All reads before any write, per Firestore transaction rules.
    const docs = await Promise.all(targets.map((t) => transaction.get(t.subscriptionRef)));

    const revokedUserIds = [];
    targets.forEach((t, i) => {
      const doc = docs[i];
      if (doc.exists && doc.data().source === 'REVENUECAT') {
        transaction.set(t.subscriptionRef, { tier: 'FREE', billingIssueAt: null }, { merge: true });
        revokedUserIds.push(t.uid);
      }
    });

    transaction.set(logRef, {
      eventId,
      eventType: 'TRANSFER',
      transferredFrom,
      revokedUserIds,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, revokedUserIds };
  });
}

module.exports = { processRevenueCatTransferEvent };
