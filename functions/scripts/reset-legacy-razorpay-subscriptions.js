// One-off admin script: resets pre-retirement `users/{uid}/data/subscription` docs that still carry
// `source: 'RAZORPAY'` (Razorpay was retired 2026-09-25; RevenueCat is the only writer now).
// Why: the Kotlin `activeOnWebInstead` guard blocks a mobile purchase while a RAZORPAY-sourced doc
// has an unexpired `expiryDate`, so legacy test docs must not linger. Mirrors `set-admin-claim.js`'s
// plain-Node/ADC convention -- not run as part of any deploy.
//
// Usage (DRY-RUN by default -- prints the plan, writes nothing):
//   node scripts/reset-legacy-razorpay-subscriptions.js            # preview
//   node scripts/reset-legacy-razorpay-subscriptions.js --apply    # perform the reset
//
// Each reset sets `tier: FREE` and deletes `source`, `expiryDate`, `subscriptionId`, `willRenew`
// (`startDate` and `billingCycle` are kept). Each doc is re-read inside a transaction and skipped
// if it no longer reads RAZORPAY, so a doc RevenueCat rewrote in the meantime is never clobbered.
// Idempotent: a second run finds nothing to do.
const admin = require('firebase-admin');

const EXPECTED_PROJECT_ID = 'ssbmax-49e68';
const SUBSCRIPTION_DOC_ID = 'subscription';
const LEGACY_SOURCE = 'RAZORPAY';
const DELETE = admin.firestore.FieldValue.delete();

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

/** Every `data/subscription` doc whose `source` is still RAZORPAY, as `{ path, data }`. */
async function findLegacyRazorpayDocs(db) {
  const found = [];
  for await (const snap of db.collectionGroup('data').stream()) {
    const data = snap.data();
    if (snap.id === SUBSCRIPTION_DOC_ID && data && data.source === LEGACY_SOURCE) {
      found.push({ path: snap.ref.path, data });
    }
  }
  return found;
}

function buildResetUpdate() {
  return { tier: 'FREE', source: DELETE, expiryDate: DELETE, subscriptionId: DELETE, willRenew: DELETE };
}

/** The reviewable plan: only tier/source/expiry of the current doc are echoed, never other fields. */
function planReset(docs) {
  return docs.map(({ path, data }) => ({
    path,
    before: { tier: data.tier, source: data.source, expiryDate: data.expiryDate },
    update: buildResetUpdate()
  }));
}

async function applyReset(db, plan, { apply }) {
  if (!apply) return { applied: 0, skipped: 0, dryRun: true };

  let applied = 0;
  let skipped = 0;
  for (const item of plan) {
    const ref = db.doc(item.path);
    const didApply = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().source !== LEGACY_SOURCE) return false;
      tx.update(ref, item.update);
      return true;
    });
    if (didApply) applied += 1;
    else skipped += 1;
  }
  return { applied, skipped, dryRun: false };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  admin.initializeApp({ projectId: EXPECTED_PROJECT_ID });
  const db = admin.firestore();

  const plan = planReset(await findLegacyRazorpayDocs(db));
  console.log(`Project ${EXPECTED_PROJECT_ID}: ${plan.length} legacy RAZORPAY subscription doc(s)`);
  for (const item of plan) {
    console.log(`  ${item.path}  tier=${item.before.tier} expiryDate=${item.before.expiryDate ?? 'none'}  -> FREE, source/expiry cleared`);
  }

  const result = await applyReset(db, plan, { apply });
  if (result.dryRun) {
    console.log('DRY RUN: nothing written. Re-run with --apply to perform the reset.');
  } else {
    console.log(`Applied ${result.applied}, skipped ${result.skipped} (no longer RAZORPAY).`);
  }
  process.exit(0);
}

module.exports = { EXPECTED_PROJECT_ID, DELETE, parseArgs, findLegacyRazorpayDocs, buildResetUpdate, planReset, applyReset };

if (require.main === module) {
  main().catch((error) => {
    console.error('ERR', error.message);
    process.exit(1);
  });
}
