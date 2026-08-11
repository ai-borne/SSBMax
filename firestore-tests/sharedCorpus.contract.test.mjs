// Phase 6 (docs/plans/CrossPlatform_SSOT): reads seed-shared-corpus.mjs's fixture back from
// the live Firestore emulator and asserts it decodes into the exact shape data-firebase's
// GitLive*CacheManager @Serializable DTOs expect (OirBatchDocDto, WATWordBatchDocDto,
// SRTSituationBatchDocDto, TATImageBatchDocDto, PPDTImageBatchDocDto, GTOTaskBatchDocDto,
// GPEImageBatchDocDto, CloudStudyMaterialDto, SubscriptionUsageDto -- see their definitions
// in data-firebase/src/commonMain/kotlin/com/ssbmax/shared/data/repository/).
//
// This is a proxy for the real Kotlin reader, not the reader itself: data-firebase's
// androidUnitTest suite cannot reach a live Firestore emulator (GitLive's Android client
// eagerly initializes every Firebase product on FirebaseApp.initializeApp(), including
// Crashlytics, which needs its Gradle plugin applied to generate a build ID resource --
// confirmed by spike, not assumed; see Phase 6 handoff for the full trace). Asserting the
// exact DTO field names here still closes the real gap this phase targets: renaming a field
// in fixtures/shared-corpus.json without updating the Kotlin DTOs fails this suite, and
// without updating web's mapper fails sharedCorpusEmulator.test.ts -- both readers exercise
// the identical seeded document.
//
// Run via `firebase emulators:exec --only firestore \
//   "node firestore-tests/seed-shared-corpus.mjs && npm --prefix firestore-tests test"`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { FirestorePaths } from '../generated/contracts.cjs';

const corpus = JSON.parse(readFileSync(new URL('fixtures/shared-corpus.json', import.meta.url), 'utf8'));

let testEnv;
let db;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.CORPUS_PROJECT_ID || 'ssbmax-49e68',
    firestore: {
      rules: readFileSync('../firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
  // test_content/study_materials require an authenticated read (firestore.rules); the
  // subscription usage doc requires the reader to own it (isOwner(userId)) -- match that
  // uid to fixtures/shared-corpus.json's subscriptionUsage.path.
  db = testEnv.authenticatedContext('corpus_test_user').firestore();
});

after(async () => {
  await testEnv.cleanup();
});

function docRefFromPath(path) {
  const segments = path.split('/');
  let ref = db;
  segments.forEach((segment, i) => {
    ref = i % 2 === 0 ? ref.collection(segment) : ref.doc(segment);
  });
  return ref;
}

test('OIR batch lives at the generated FirestorePaths.TestContent.OIR_BATCHES path and decodes into OirBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.OIR_BATCHES}/batch_pdf_001`;
  assert.equal(corpus.oir.path, expectedPath);

  const snap = await docRefFromPath(corpus.oir.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.questions));
  assert.equal(data.questions.length, 2);
  const q = data.questions[0];
  assert.equal(typeof q.id, 'string');
  assert.equal(typeof q.questionText, 'string');
  assert.ok(Array.isArray(q.options));
  assert.equal(typeof q.correctAnswerId, 'string');
  assert.equal(typeof q.explanation, 'string');
});

test('PPDT batch lives at the generated FirestorePaths.TestContent.PPDT_BATCHES path and decodes into PPDTImageBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.PPDT_BATCHES}/batch_001`;
  assert.equal(corpus.ppdt.path, expectedPath);

  const snap = await docRefFromPath(corpus.ppdt.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.images));
  const img = data.images[0];
  assert.equal(typeof img.imageUrl, 'string');
  assert.equal(typeof img.viewingTimeSeconds, 'number');
  assert.equal(typeof img.writingTimeMinutes, 'number');
});

test('TAT batch lives at the generated FirestorePaths.TestContent.TAT_BATCHES path and decodes into TATImageBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.TAT_BATCHES}/batch_001`;
  assert.equal(corpus.tat.path, expectedPath);

  const snap = await docRefFromPath(corpus.tat.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.images));
  assert.equal(typeof data.images[0].cardPosition, 'number');
});

test('WAT batch lives at the generated FirestorePaths.TestContent.WAT_BATCHES path and decodes into WATWordBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.WAT_BATCHES}/batch_001`;
  assert.equal(corpus.wat.path, expectedPath);

  const snap = await docRefFromPath(corpus.wat.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.words));
  assert.equal(typeof data.words[0].word, 'string');
  assert.equal(typeof data.words[0].timeAllowedSeconds, 'number');
});

test('SRT batch lives at the generated FirestorePaths.TestContent.SRT_BATCHES path and decodes into SRTSituationBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.SRT_BATCHES}/batch_001`;
  assert.equal(corpus.srt.path, expectedPath);

  const snap = await docRefFromPath(corpus.srt.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.situations));
  assert.equal(typeof data.situations[0].situation, 'string');
});

test('GTO task batch lives at the generated FirestorePaths.TestContent.GTO_BATCHES path and decodes into GTOTaskBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.GTO_BATCHES}/batch_001`;
  assert.equal(corpus.gto.path, expectedPath);

  const snap = await docRefFromPath(corpus.gto.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.tasks));
  assert.ok(data.tasks.some((t) => t.taskType === 'GD'));
  assert.ok(data.tasks.some((t) => t.taskType === 'LECTURETTE'));
});

test('GPE batch lives at the generated FirestorePaths.TestContent.GPE_BATCHES path and decodes into GPEImageBatchDocDto shape', async () => {
  const expectedPath = `${FirestorePaths.TestContent.GPE_BATCHES}/batch_001`;
  assert.equal(corpus.gpe.path, expectedPath);

  const snap = await docRefFromPath(corpus.gpe.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.ok(Array.isArray(data.images));
  assert.ok(Array.isArray(data.images[0].resources));
});

test('study material lives at the generated FirestorePaths.STUDY_MATERIALS path and decodes into CloudStudyMaterialDto shape', async () => {
  const expectedPath = `${FirestorePaths.STUDY_MATERIALS}/mat_oir_101`;
  assert.equal(corpus.studyMaterial.path, expectedPath);

  const snap = await docRefFromPath(corpus.studyMaterial.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  assert.equal(typeof data.title, 'string');
  assert.equal(typeof data.contentMarkdown, 'string');
});

test('subscription usage doc decodes into SubscriptionUsageDto shape with all 9 per-test counters', async () => {
  const snap = await docRefFromPath(corpus.subscriptionUsage.path).get();
  assert.ok(snap.exists);
  const data = snap.data();

  for (const field of [
    'oirTestsUsed', 'ppdtTestsUsed', 'piqTestsUsed', 'tatTestsUsed', 'watTestsUsed',
    'srtTestsUsed', 'sdTestsUsed', 'gtoTestsUsed', 'interviewTestsUsed'
  ]) {
    assert.equal(typeof data[field], 'number', `${field} must be a number`);
  }
  assert.ok(Array.isArray(data.recordedSubmissionIds));
});
