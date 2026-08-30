// Phase 6 (docs/plans/CrossPlatform_SSOT): exercises ContentRepository against the SAME
// live Firestore emulator + fixture corpus that firestore-tests/sharedCorpus.contract.test.mjs
// reads (seeded once by firestore-tests/seed-shared-corpus.mjs -- see fixtures/shared-corpus.json,
// the one JSON source both readers assert against). Uses the real firebase/firestore SDK
// (connectFirestoreEmulator), not the vi.mock('firebase/firestore', ...) every other file in
// this directory uses -- that mock pattern is exactly what let firestoreSchemaContract.test.ts
// lock in a wrong path (§3.6 of the plan) instead of catching it. A field renamed in the
// fixture without updating this mapper fails here; without updating the Kotlin DTOs it fails
// the Node suite -- together they close the cross-platform drift gap no per-platform mock ever
// could.
//
// Excluded from the default `npm test` (see vitest.config.ts's `exclude`) since it needs a
// live emulator on 127.0.0.1:8080. The emulator partitions data by project id, so the
// seeder and this file must name the SAME one -- do not rely on web/.env, which is
// gitignored and absent on CI (firebase.ts then falls back to 'ssbmax-demo' and every read
// comes back empty). Run via:
//   CORPUS_PROJECT_ID=demo-ssbmax-corpus VITE_FIREBASE_PROJECT_ID=demo-ssbmax-corpus \
//   firebase emulators:exec --only firestore,auth --project demo-ssbmax-corpus \
//     "node ../firestore-tests/seed-shared-corpus.mjs && npm run test:corpus"
import { describe, it, expect, beforeAll } from 'vitest';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { db, auth } from '@/config/firebase';
import { ContentRepository } from '@/repositories/ContentRepository';

beforeAll(async () => {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // firestore.rules requires isAuthenticated() to read test_content/study_materials --
  // anonymous auth is enough, the rules don't check tier/role for content reads.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInAnonymously(auth);
});

describe('Shared-corpus emulator contract tests (Phase 6)', () => {
  const repository = new ContentRepository();

  it('CONTRACT: getOIRQuestions reads the seeded batch and strips the anti-cheat fields', async () => {
    const result = await repository.getOIRQuestions(0);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].questionText).toContain('CANDID');
    result.items.forEach((item) => {
      expect((item as unknown as Record<string, unknown>).correctAnswerId).toBeUndefined();
      expect((item as unknown as Record<string, unknown>).explanation).toBeUndefined();
    });
  });

  it('CONTRACT: getPPDTContext reads the seeded batch and normalizes the gs:// image URL', async () => {
    const result = await repository.getPPDTContext('batch_001');

    expect(result.imageUrl).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/ppdt/image_1.png');
    expect(result.writingTimeSeconds).toBe(240);
  });

  it('CONTRACT: getTATSet reads the seeded batch and appends the 12th blank card', async () => {
    const result = await repository.getTATSet('batch_001');

    expect(result.totalSlides).toBe(12);
    expect(result.imageUrls[11]).toBe('blank');
  });

  it('CONTRACT: getWATBatch reads the seeded batch\'s word objects', async () => {
    const result = await repository.getWATBatch('batch_001');

    expect(result.words).toContain('LEADERSHIP');
    expect(result.words).toContain('COURAGE');
  });

  it('CONTRACT: getSRTBatch reads the seeded batch\'s situation objects', async () => {
    const result = await repository.getSRTBatch('batch_001');

    expect(result.situations[0]).toContain('road accident victim');
  });

  it('CONTRACT: getGPEBatch reads the seeded batch and strips the anti-cheat solution field', async () => {
    const result = await repository.getGPEBatch('batch_001');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].scenario).toContain('flooded river');
    expect(result.items[0].resources).toContain('rope');
    result.items.forEach((item) => {
      expect((item as unknown as Record<string, unknown>).solution).toBeUndefined();
    });
  });

  it('CONTRACT: getOIRContentVersion reads the seeded meta/config doc', async () => {
    const result = await repository.getOIRContentVersion();

    expect(result.batchCount).toBe(28);
    expect(result.contentVersion).toBe(1);
  });

  it('CONTRACT: getStudyMaterials reads the seeded study_materials doc', async () => {
    const materials = await repository.getStudyMaterials();

    const seeded = materials.find((m) => m.title === 'SSOT OIR Guide');
    expect(seeded).toBeDefined();
    expect(seeded?.contentMarkdown).toBe('# Full OIR Guide Content');
  });
});
