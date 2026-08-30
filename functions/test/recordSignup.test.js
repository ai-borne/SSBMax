/**
 * Phase 8 (ai_search_readiness plan): tests for `src/analytics/recordSignup.js`. Two things
 * matter here: the auth boundary (an unauthenticated caller must not be able to inflate the
 * counter), and that repeated calls on the same day accumulate into one doc via
 * FieldValue.increment rather than clobbering or duplicating -- that's the entire reason a
 * date-keyed doc + increment was chosen over an append-only event log.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { recordSignup, recordSignupForToday, todayDocId } = require('../src/analytics/recordSignup');

/** Understands admin.firestore.FieldValue.increment()'s real sentinel shape
 * (`NumericIncrementTransform { operand }`) closely enough to emulate merge+increment writes
 * without a live Firestore connection. */
function makeFakeDb() {
  const store = new Map();
  return {
    collection(name) {
      if (name !== 'analytics_daily') throw new Error(`unexpected collection ${name}`);
      return {
        doc: (id) => ({
          async set(data, options) {
            const existing = options?.merge ? store.get(id) || {} : {};
            const merged = { ...existing };
            for (const [key, value] of Object.entries(data)) {
              merged[key] = value?.constructor?.name === 'NumericIncrementTransform'
                ? (existing[key] || 0) + value.operand
                : value;
            }
            store.set(id, merged);
          },
          async get() {
            const data = store.get(id);
            return { exists: data !== undefined, data: () => data };
          }
        })
      };
    },
    _store: store
  };
}

test('recordSignup rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => recordSignup.run({}, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('todayDocId formats as yyyy-MM-dd in UTC', () => {
  assert.equal(todayDocId(Date.UTC(2026, 7, 29, 23, 59)), '2026-08-29');
});

test('recordSignupForToday writes to today\'s date-keyed doc id and returns it', async () => {
  const db = makeFakeDb();
  const nowMillis = Date.UTC(2026, 7, 29, 12, 0);
  const result = await recordSignupForToday(db, nowMillis);
  assert.equal(result.date, '2026-08-29');
  const snap = await db.collection('analytics_daily').doc('2026-08-29').get();
  assert.equal(snap.data().signups, 1);
});

test('recordSignupForToday accumulates via increment across repeated calls on the same day, without clobbering', async () => {
  const db = makeFakeDb();
  const nowMillis = Date.UTC(2026, 7, 29, 9, 0);
  await recordSignupForToday(db, nowMillis);
  await recordSignupForToday(db, nowMillis + 1000);
  await recordSignupForToday(db, nowMillis + 2000);
  const snap = await db.collection('analytics_daily').doc('2026-08-29').get();
  assert.equal(snap.data().signups, 3);
});

test('recordSignupForToday propagates a Firestore write failure to its caller (the onCall wrapper converts it to an internal HttpsError)', async () => {
  const brokenDb = {
    collection() {
      return { doc: () => ({ async set() { throw new Error('boom'); } }) };
    }
  };
  await assert.rejects(
    () => recordSignupForToday(brokenDb),
    /boom/
  );
});
