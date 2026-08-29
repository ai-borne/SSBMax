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

  const legacyCollections = new Set(['topic_content', 'study_materials']);
  const sectionsCollections = new Set(['topic_sections', 'study_material_sections']);
  assert.ok(
    docs.some((d) => sectionsCollections.has(d.collection)),
    'expected buildDocs() to also produce D2 side documents (topic_sections / study_material_sections)'
  );

  await publishDocs(db, docs);

  for (const doc of docs) {
    const snap = await db.collection(doc.collection).doc(doc.id).get();
    assert.ok(snap.exists, `${doc.collection}/${doc.id} was not written`);
    const stored = snap.data();
    for (const [key, value] of Object.entries(doc.data)) {
      assert.deepEqual(stored[key], value, `${doc.collection}/${doc.id}.${key} mismatch after round-trip`);
    }
  }

  // D2's whole risk-elimination argument rests on this: the legacy topic_content /
  // study_materials documents must be byte-identical to what a pre-Phase-5 publish would have
  // written -- exactly the frontmatter fields plus the one markdown body field, nothing more.
  for (const doc of docs.filter((d) => legacyCollections.has(d.collection))) {
    const snap = await db.collection(doc.collection).doc(doc.id).get();
    assert.deepEqual(
      snap.data(),
      doc.data,
      `${doc.collection}/${doc.id} gained/lost fields relative to the pre-Phase-5 shape`
    );
  }

  // The side documents carry a real DocumentModel ({ sections: [...] }), not a stray copy of
  // the markdown body -- a regression here would silently ship an empty structured renderer.
  for (const doc of docs.filter((d) => sectionsCollections.has(d.collection))) {
    assert.ok(Array.isArray(doc.data.sections), `${doc.collection}/${doc.id} is missing a sections array`);
    assert.ok(doc.data.sections.length > 0, `${doc.collection}/${doc.id} has zero sections`);
  }

  t.diagnostic(`round-tripped ${docs.length} docs (${errors.length} placeholder files correctly excluded)`);
});
