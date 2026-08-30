/**
 * Phase 1 (docs/plans/AccountDeletion.md): cascade-delete unit tests. Fakes the Firestore
 * Admin SDK surface `cascadeDeleteUserData` needs (`.where().limit().get()`, `.batch()`,
 * `.doc()`, `.recursiveDelete()`) with an in-memory store so every collection in the cascade
 * table can be asserted precisely -- both what gets deleted and what must not.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cascadeDeleteUserData,
  deleteQueryBatch,
  USER_ID_SCOPED_COLLECTIONS,
  RETAINED_COLLECTIONS
} = require('../../src/account/cascadeDelete');
const { FirestorePaths } = require('../../src/generated/contracts.cjs');

/**
 * In-memory fake Firestore: `docs` maps collectionName -> array of {id, data}. Supports the
 * subset of the Admin SDK surface the cascade needs, including a naive `.recursiveDelete`
 * that deletes the doc plus anything the test registered as its "subcollection".
 */
function makeFakeDb(initialDocs = {}) {
  const store = {};
  for (const [coll, docs] of Object.entries(initialDocs)) {
    store[coll] = docs.map((d) => ({ id: d.id, data: d.data }));
  }
  const recursivelyDeletedRefs = [];

  function collection(name) {
    store[name] = store[name] || [];
    return {
      where(field, op, value) {
        return {
          limit(n) {
            return {
              async get() {
                const matched = store[name].filter((d) => d.data[field] === value).slice(0, n);
                return {
                  empty: matched.length === 0,
                  docs: matched.map((d) => ({
                    ref: { delete: () => {
                      store[name] = store[name].filter((x) => x.id !== d.id);
                    } }
                  }))
                };
              }
            };
          }
        };
      },
      doc(id) {
        return {
          async get() {
            const found = store[name].find((d) => d.id === id);
            return { exists: !!found, data: () => found && found.data };
          },
          async set(value) {
            store[name] = store[name].filter((d) => d.id !== id).concat([{ id, data: value }]);
          },
          async update(value) {
            const found = store[name].find((d) => d.id === id);
            if (found) Object.assign(found.data, value);
          },
          async delete() {
            store[name] = store[name].filter((d) => d.id !== id);
          }
        };
      }
    };
  }

  return {
    collection,
    batch() {
      const ops = [];
      return {
        delete(ref) {
          ops.push(ref);
        },
        async commit() {
          ops.forEach((ref) => ref.delete());
        }
      };
    },
    async recursiveDelete(ref) {
      recursivelyDeletedRefs.push(ref);
      await ref.delete();
    },
    _store: store,
    _recursivelyDeletedRefs: recursivelyDeletedRefs
  };
}

test('Phase 1: deleteQueryBatch deletes every matching doc and returns the count', async () => {
  const db = makeFakeDb({ submissions: [{ id: 's1', data: { userId: 'u1' } }, { id: 's2', data: { userId: 'u1' } }, { id: 's3', data: { userId: 'other' } }] });
  const query = db.collection('submissions').where('userId', '==', 'u1');
  const deleted = await deleteQueryBatch(db, query);
  assert.equal(deleted, 2);
  assert.deepEqual(db._store.submissions.map((d) => d.id), ['s3']);
});

test('Phase 1: cascadeDeleteUserData deletes from every userId-scoped collection in the cascade table', async () => {
  const initial = {};
  for (const coll of USER_ID_SCOPED_COLLECTIONS) {
    initial[coll] = [{ id: `${coll}-doc`, data: { userId: 'u1' } }, { id: `${coll}-other`, data: { userId: 'other' } }];
  }
  initial[FirestorePaths.NOTIFICATION_PREFERENCES] = [{ id: 'u1', data: { userId: 'u1' } }];
  initial[FirestorePaths.USERS] = [{ id: 'u1', data: {} }];
  const db = makeFakeDb(initial);

  const result = await cascadeDeleteUserData(db, 'u1');

  for (const coll of USER_ID_SCOPED_COLLECTIONS) {
    assert.equal(result[coll], 1, `expected exactly one doc deleted from ${coll}`);
    assert.deepEqual(db._store[coll].map((d) => d.id), [`${coll}-other`], `other users' docs in ${coll} must survive`);
  }
});

test('Phase 1: cascadeDeleteUserData deletes notificationPreferences by doc id (not a userId query)', async () => {
  const db = makeFakeDb({ [FirestorePaths.NOTIFICATION_PREFERENCES]: [{ id: 'u1', data: {} }, { id: 'u2', data: {} }] });
  const result = await cascadeDeleteUserData(db, 'u1');
  assert.equal(result[FirestorePaths.NOTIFICATION_PREFERENCES], 1);
  assert.deepEqual(db._store[FirestorePaths.NOTIFICATION_PREFERENCES].map((d) => d.id), ['u2']);
});

test('Phase 1: cascadeDeleteUserData recursively deletes users/{uid} last', async () => {
  const db = makeFakeDb({ [FirestorePaths.USERS]: [{ id: 'u1', data: {} }] });
  await cascadeDeleteUserData(db, 'u1');
  assert.equal(db._recursivelyDeletedRefs.length, 1);
  assert.equal(db._store[FirestorePaths.USERS].length, 0);
});

test('Phase 1: cascadeDeleteUserData never touches retained collections (payments/webhook_logs/ops_alerts)', async () => {
  const db = makeFakeDb({
    payments: [{ id: 'p1', data: { userId: 'u1' } }],
    webhook_logs: [{ id: 'w1', data: { userId: 'u1' } }],
    ops_alerts: [{ id: 'o1', data: { userId: 'u1' } }]
  });
  await cascadeDeleteUserData(db, 'u1');
  for (const coll of RETAINED_COLLECTIONS) {
    assert.equal(db._store[coll].length, 1, `${coll} must be untouched by the cascade`);
  }
});
