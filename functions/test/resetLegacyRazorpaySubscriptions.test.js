/**
 * Razorpay retirement (2026-09-25): tests for `scripts/reset-legacy-razorpay-subscriptions.js`.
 * Pre-retirement docs still carry `source: 'RAZORPAY'`; the Kotlin `activeOnWebInstead` guard reads
 * that source + `expiryDate`, so an unexpired legacy doc blocks a mobile purchase. The script
 * resets them to FREE. It is dry-run by default and only touches docs that still read RAZORPAY.
 * Everything runs against an injectable fake db -- never a live project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_PROJECT_ID,
  DELETE,
  parseArgs,
  findLegacyRazorpayDocs,
  buildResetUpdate,
  planReset,
  applyReset
} = require('../scripts/reset-legacy-razorpay-subscriptions');

function makeSnap(path, data) {
  return { id: path.split('/').pop(), ref: { path }, data: () => data };
}

/** Fake db: `collectionGroup('data')` streams the seeded docs; `runTransaction` reads/writes them. */
function makeFakeDb(seed) {
  const store = new Map(Object.entries(seed));
  const writes = [];
  return {
    writes,
    store,
    collectionGroup(name) {
      assert.equal(name, 'data');
      return {
        async *stream() {
          for (const [path, data] of store) yield makeSnap(path, data);
        }
      };
    },
    doc: (path) => ({ path }),
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, update) {
          writes.push({ path: ref.path, update });
          const next = { ...store.get(ref.path) };
          for (const [key, value] of Object.entries(update)) {
            if (value === DELETE) delete next[key];
            else next[key] = value;
          }
          store.set(ref.path, next);
        }
      };
      return fn(tx);
    }
  };
}

const LEGACY_PRO = { tier: 'PRO', source: 'RAZORPAY', expiryDate: 1793125800000, willRenew: true, subscriptionId: 'sub_1', startDate: 1, billingCycle: 'MONTHLY' };

test('parseArgs: dry-run by default, --apply opts in', () => {
  assert.deepEqual(parseArgs([]), { apply: false });
  assert.deepEqual(parseArgs(['--apply']), { apply: true });
});

test('the script is pinned to the ssbmax project', () => {
  assert.equal(EXPECTED_PROJECT_ID, 'ssbmax-49e68');
});

test('findLegacyRazorpayDocs returns only users/*/data/subscription docs whose source is RAZORPAY', async () => {
  const db = makeFakeDb({
    'users/a/data/subscription': LEGACY_PRO,
    'users/b/data/subscription': { tier: 'BASIC', source: 'REVENUECAT' },
    'users/c/data/profile': { source: 'RAZORPAY' },
    'users/d/data/subscription': { tier: 'FREE' }
  });

  const found = await findLegacyRazorpayDocs(db);

  assert.deepEqual(found.map((d) => d.path), ['users/a/data/subscription']);
});

test('buildResetUpdate sets FREE and clears the Razorpay-owned fields, keeping startDate and billingCycle', () => {
  const update = buildResetUpdate();

  assert.equal(update.tier, 'FREE');
  for (const field of ['source', 'expiryDate', 'subscriptionId', 'willRenew']) {
    assert.equal(update[field], DELETE, `${field} must be deleted`);
  }
  assert.equal('startDate' in update, false);
  assert.equal('billingCycle' in update, false);
});

test('planReset describes each doc without exposing more than tier/expiry/source, and never the uid-less path only', () => {
  const plan = planReset([{ path: 'users/a/data/subscription', data: LEGACY_PRO }]);

  assert.deepEqual(plan, [
    { path: 'users/a/data/subscription', before: { tier: 'PRO', source: 'RAZORPAY', expiryDate: 1793125800000 }, update: buildResetUpdate() }
  ]);
});

test('dry-run (apply=false) writes nothing', async () => {
  const db = makeFakeDb({ 'users/a/data/subscription': LEGACY_PRO });
  const plan = planReset(await findLegacyRazorpayDocs(db));

  const result = await applyReset(db, plan, { apply: false });

  assert.equal(db.writes.length, 0);
  assert.deepEqual(result, { applied: 0, skipped: 0, dryRun: true });
  assert.equal(db.store.get('users/a/data/subscription').tier, 'PRO');
});

test('apply resets tier to FREE and removes the legacy fields', async () => {
  const db = makeFakeDb({ 'users/a/data/subscription': LEGACY_PRO });
  const plan = planReset(await findLegacyRazorpayDocs(db));

  const result = await applyReset(db, plan, { apply: true });

  assert.deepEqual(result, { applied: 1, skipped: 0, dryRun: false });
  assert.deepEqual(db.store.get('users/a/data/subscription'), { tier: 'FREE', startDate: 1, billingCycle: 'MONTHLY' });
});

test('apply skips a doc that RevenueCat rewrote after the scan (source no longer RAZORPAY) -- never clobbers a live entitlement', async () => {
  const db = makeFakeDb({ 'users/a/data/subscription': LEGACY_PRO });
  const plan = planReset(await findLegacyRazorpayDocs(db));
  db.store.set('users/a/data/subscription', { tier: 'BASIC', source: 'REVENUECAT', expiryDate: 9 });

  const result = await applyReset(db, plan, { apply: true });

  assert.deepEqual(result, { applied: 0, skipped: 1, dryRun: false });
  assert.equal(db.store.get('users/a/data/subscription').tier, 'BASIC');
});

test('apply is idempotent: a second run finds nothing left to reset', async () => {
  const db = makeFakeDb({ 'users/a/data/subscription': LEGACY_PRO });
  await applyReset(db, planReset(await findLegacyRazorpayDocs(db)), { apply: true });

  assert.deepEqual(await findLegacyRazorpayDocs(db), []);
});
