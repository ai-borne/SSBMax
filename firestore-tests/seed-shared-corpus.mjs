// Phase 6 (docs/plans/CrossPlatform_SSOT): seeds fixtures/shared-corpus.json into the
// Firestore emulator so both readers -- this suite's sharedCorpus.contract.test.mjs and
// web's tests/unit/contracts/sharedCorpusEmulator.test.ts -- exercise identical documents.
//
// Run once per `firebase emulators:exec` session, before either reader:
//   firebase emulators:exec --only firestore \
//     "node firestore-tests/seed-shared-corpus.mjs && npm --prefix firestore-tests test && npm --prefix web run test:corpus"
//
// Uses @firebase/rules-unit-testing (already a firestore-tests dependency) with security
// rules disabled for the write -- the corpus must land regardless of what firestore.rules
// currently allows a client to write, since production content is seeded by ingestion
// scripts/Cloud Functions, not client writes. Same compat-SDK style (ctx.firestore()) as
// the existing *.rules.test.mjs files in this directory.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const corpus = JSON.parse(readFileSync(new URL('fixtures/shared-corpus.json', import.meta.url), 'utf8'));

const projectId = process.env.CORPUS_PROJECT_ID || 'ssbmax-49e68';

/** Builds a doc reference from a slash-separated path, alternating collection()/doc(). */
function docRefFromPath(db, path) {
  const segments = path.split('/');
  let ref = db;
  segments.forEach((segment, i) => {
    ref = i % 2 === 0 ? ref.collection(segment) : ref.doc(segment);
  });
  return ref;
}

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8080 }
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [key, entry] of Object.entries(corpus)) {
    if (key.startsWith('_')) continue;
    await docRefFromPath(db, entry.path).set(entry.doc);
    console.log(`seeded ${key} -> ${entry.path}`);
  }
});

await testEnv.cleanup();
console.log(`\n✅ Shared corpus seeded into project "${projectId}".`);
