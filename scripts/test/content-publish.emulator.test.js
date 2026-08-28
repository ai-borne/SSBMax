/**
 * Round-trip test for scripts/content/publishContent.js against a real
 * Firestore emulator (not mocked): content/ -> Firestore -> read back must
 * match. Requires FIRESTORE_EMULATOR_HOST to be set, i.e. run via
 * `npm run test:emulator` (wraps this in `firebase emulators:exec`), never
 * directly — see BLOCKER 3, docs/plans/i-just-watched-a-nested-russell.md.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

test('publishContent: content/ -> Firestore emulator -> read back matches', async (t) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    t.skip('requires FIRESTORE_EMULATOR_HOST — run via `npm run test:emulator`');
    return;
  }

  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-ssbmax' });
  const db = admin.firestore();

  const { buildDocs, publishDocs } = require('../content/publishContent');
  const { docs, errors } = buildDocs();

  assert.ok(docs.length > 0, 'expected at least one publishable content file');

  await publishDocs(db, docs);

  for (const doc of docs) {
    const snap = await db.collection(doc.collection).doc(doc.id).get();
    assert.ok(snap.exists, `${doc.collection}/${doc.id} was not written`);
    const stored = snap.data();
    for (const [key, value] of Object.entries(doc.data)) {
      assert.deepEqual(stored[key], value, `${doc.collection}/${doc.id}.${key} mismatch after round-trip`);
    }
  }

  t.diagnostic(`round-tripped ${docs.length} docs (${errors.length} placeholder files correctly excluded)`);
});
