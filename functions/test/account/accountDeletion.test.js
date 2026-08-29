/**
 * Phase 1 (docs/plans/AccountDeletion.md): unit tests for the three account-deletion core
 * functions, run against fakes rather than the callable wrappers (unauthenticated rejection
 * of the wrapper itself mirrors eligibility.test.js's convention of testing core logic
 * directly, since `functions.https.onCall`'s context plumbing isn't the thing under test).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { requestAccountDeletion, requestAccountDeletionCore } = require('../../src/account/requestAccountDeletion');
const { cancelAccountDeletion, cancelAccountDeletionCore } = require('../../src/account/cancelAccountDeletion');
const { purgeExpiredAccountsCore, GRACE_PERIOD_DAYS } = require('../../src/account/purgeExpiredAccounts');
const { FirestorePaths } = require('../../src/generated/contracts.cjs');

function makeContext(uid) {
  return uid ? { auth: { uid } } : { auth: null };
}

function makeFakeDb(users = {}) {
  const store = { [FirestorePaths.USERS]: { ...users } };
  return {
    collection(name) {
      store[name] = store[name] || {};
      return {
        doc(id) {
          return {
            async get() {
              const data = store[name][id];
              return { exists: data !== undefined, data: () => data };
            },
            async set(value, opts) {
              if (opts && opts.merge) {
                store[name][id] = { ...(store[name][id] || {}), ...value };
              } else {
                store[name][id] = value;
              }
            },
            async update(value) {
              const current = { ...(store[name][id] || {}) };
              for (const [k, v] of Object.entries(value)) {
                if (v && v.constructor && v.constructor.name === 'DeleteTransform') delete current[k];
                else current[k] = v;
              }
              store[name][id] = current;
            },
            async delete() {
              delete store[name][id];
            }
          };
        },
        where(field, op, value) {
          const matchFn = (data) => {
            if (data[field] === undefined) return false;
            return op === '==' ? data[field] === value : data[field] <= value;
          };
          const runGet = () => {
            const matched = Object.entries(store[name])
              .filter(([, data]) => matchFn(data))
              .map(([id]) => ({ id, ref: { delete: async () => { delete store[name][id]; } } }));
            return { empty: matched.length === 0, docs: matched };
          };
          return {
            async get() {
              return runGet();
            },
            limit(n) {
              return {
                async get() {
                  const result = runGet();
                  return { empty: result.empty, docs: result.docs.slice(0, n) };
                }
              };
            }
          };
        }
      };
    },
    batch() {
      const ops = [];
      return {
        delete(ref) {
          ops.push(ref);
        },
        async commit() {
          for (const ref of ops) await ref.delete();
        }
      };
    },
    async recursiveDelete(ref) {
      await ref.delete();
    },
    _store: store
  };
}

function makeFakeAuthAdmin() {
  const disabledUids = new Set();
  const deletedUids = new Set();
  return {
    async updateUser(uid, { disabled }) {
      if (disabled) disabledUids.add(uid);
      else disabledUids.delete(uid);
    },
    async deleteUser(uid) {
      deletedUids.add(uid);
    },
    _disabledUids: disabledUids,
    _deletedUids: deletedUids
  };
}

test('Phase 1: requestAccountDeletion callable rejects an unauthenticated call', async () => {
  await assert.rejects(
    () => requestAccountDeletion.run({}, makeContext(undefined)),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('Phase 1: cancelAccountDeletion callable rejects an unauthenticated call', async () => {
  await assert.rejects(
    () => cancelAccountDeletion.run({}, makeContext(undefined)),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('Phase 1: requestAccountDeletion sets deletionRequestedAt and disables the account without touching data', async () => {
  const db = makeFakeDb({ u1: { name: 'test' } });
  const authAdmin = makeFakeAuthAdmin();
  const result = await requestAccountDeletionCore(db, authAdmin, 'u1');
  assert.equal(result.success, true);
  assert.ok(db._store[FirestorePaths.USERS].u1.deletionRequestedAt !== undefined);
  assert.equal(db._store[FirestorePaths.USERS].u1.name, 'test', 'existing profile data must survive the request step');
  assert.ok(authAdmin._disabledUids.has('u1'));
});

test('Phase 1: cancelAccountDeletion within the window re-enables the account and clears the field', async () => {
  const db = makeFakeDb({ u1: { deletionRequestedAt: Date.now() } });
  const authAdmin = makeFakeAuthAdmin();
  authAdmin._disabledUids.add('u1');
  const result = await cancelAccountDeletionCore(db, authAdmin, 'u1');
  assert.equal(result.success, true);
  assert.ok(!authAdmin._disabledUids.has('u1'));
});

test('Phase 1: cancelAccountDeletion rejects failed-precondition when there is no pending request', async () => {
  const db = makeFakeDb({ u1: {} });
  const authAdmin = makeFakeAuthAdmin();
  await assert.rejects(
    () => cancelAccountDeletionCore(db, authAdmin, 'u1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('Phase 1: cancelAccountDeletion rejects failed-precondition once the account has already been purged', async () => {
  const db = makeFakeDb({}); // purgeExpiredAccounts already deleted the user doc entirely
  const authAdmin = makeFakeAuthAdmin();
  await assert.rejects(
    () => cancelAccountDeletionCore(db, authAdmin, 'u1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('Phase 1: purgeExpiredAccounts purges only users past the grace-period cutoff, deleting Auth strictly after Firestore', async () => {
  const past = Date.now() - (GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000;
  const withinWindow = Date.now() - 1000;
  const db = makeFakeDb({
    expired: { deletionRequestedAt: past },
    'still-in-grace': { deletionRequestedAt: withinWindow },
    'never-requested': {}
  });
  const authAdmin = makeFakeAuthAdmin();
  const cutoff = Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  const order = [];
  const originalDeleteUser = authAdmin.deleteUser.bind(authAdmin);
  authAdmin.deleteUser = async (uid) => {
    order.push('auth-delete');
    await originalDeleteUser(uid);
  };

  const result = await purgeExpiredAccountsCore(db, authAdmin, cutoff);

  assert.equal(result.purgedCount, 1);
  assert.ok(authAdmin._deletedUids.has('expired'));
  assert.ok(!authAdmin._deletedUids.has('still-in-grace'));
  assert.ok(!authAdmin._deletedUids.has('never-requested'));
  assert.deepEqual(order, ['auth-delete']);
});
