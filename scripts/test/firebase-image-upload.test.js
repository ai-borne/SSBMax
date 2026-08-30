/**
 * Round-trip test for scripts/lib/firebaseImageUpload.js against a real Storage
 * emulator (not mocked): upload a local file -> assert it is NOT publicly readable
 * (no `makePublic()` ACL) and the returned URL/storagePath shape is correct.
 * Requires STORAGE_EMULATOR_HOST to be set, i.e. run via `npm run test:storage:emulator`
 * (wraps this in `firebase emulators:exec --only storage`), never directly — same
 * reasoning as scripts/test/content-publish.emulator.test.js (BLOCKER 3).
 *
 * The Storage emulator enforces storage.rules on every request, including the
 * Admin SDK's (unlike production, where the Admin SDK bypasses rules via IAM), and
 * only recognizes admin bypass via an `Authorization: Bearer owner` header — which
 * @google-cloud/storage does not send by default for a custom (emulator) endpoint.
 * So this test builds its own bucket with an authClient that supplies that header,
 * rather than going through `admin.initializeApp()` (which would get "Permission
 * denied" from storage.rules' intentional `allow write: if false` on oir/pdf_questions).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('uploadImageAndGetUrl: uploads without makePublic() and returns a CSP-compliant URL', async (t) => {
  if (!process.env.STORAGE_EMULATOR_HOST) {
    t.skip('requires STORAGE_EMULATOR_HOST — run via `npm run test:storage:emulator`');
    return;
  }

  const { Storage: GCSStorage } = require('@google-cloud/storage');
  const admin = require('firebase-admin');
  const { getDownloadURL } = require('firebase-admin/storage');

  const PROJECT_ID = 'demo-ssbmax';
  const BUCKET = `${PROJECT_ID}.appspot.com`;

  const gcs = new GCSStorage({
    projectId: PROJECT_ID,
    apiEndpoint: process.env.STORAGE_EMULATOR_HOST,
    useAuthWithCustomEndpoint: true,
    authClient: {
      async getRequestHeaders() {
        return { Authorization: 'Bearer owner' };
      },
      projectId: PROJECT_ID,
    },
  });
  const bucket = gcs.bucket(BUCKET);

  // getDownloadURL() needs an initialized admin app to build the emulator base URL,
  // but doesn't touch its credential — only the bucket above needs the owner bypass.
  admin.initializeApp({ projectId: PROJECT_ID });

  const { uploadImageAndGetUrl } = require('../lib/firebaseImageUpload');

  const localPath = path.join(os.tmpdir(), `firebase-image-upload-test-${Date.now()}.png`);
  fs.writeFileSync(localPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  t.after(() => fs.unlinkSync(localPath));

  const destination = 'oir/pdf_questions/test-image.png';
  const { imageUrl, storagePath } = await uploadImageAndGetUrl(bucket, localPath, destination, 'image/png');

  assert.equal(storagePath, destination, 'storagePath must equal the destination passed in');
  assert.ok(
    imageUrl.includes('/v0/b/') && imageUrl.includes('alt=media') && imageUrl.includes('token='),
    `imageUrl must be a download-token URL, got: ${imageUrl}`
  );
  assert.ok(
    !imageUrl.startsWith('https://storage.googleapis.com/'),
    'imageUrl must not be the old hand-built public storage.googleapis.com URL'
  );

  // The v0 download-token URL is intentionally a bearer capability (per Firebase's own
  // design, per the migration plan this test backs) — anyone holding the token can read
  // it there regardless of storage.rules, so it can't be used to prove the object isn't
  // public.
  //
  // What makePublic() actually does is grant a GCS *object ACL* (`allUsers:objectViewer`).
  // This can't be verified against the Storage emulator: its ACL sub-resource is
  // unimplemented (`file.acl.get()` 404s "No such object .../acl" for every object,
  // public or not — confirmed during Phase 5), and `file.getMetadata()` never returns
  // an `acl` field either, against the emulator OR real production (confirmed by
  // cross-checking a real, still-public production OIR object with `gcloud storage
  // objects describe`, which correctly showed its `allUsers: READER` entry that
  // getMetadata() silently omitted). An earlier version of this assertion used
  // `metadata.acl`, which is always undefined here — it passed unconditionally
  // regardless of whether makePublic() had been called, i.e. it was vacuous.
  // So instead, assert the actual regression this test can catch: the helper's
  // source contains no makePublic() call at all. Real "is it actually public in
  // production" verification is a manual `file.acl.get()` / `gcloud storage
  // objects describe` spot-check (see revoke-public-image-acls.js and the Phase 1/5
  // commit messages), not something this emulator can exercise.
  const helperSource = fs
    .readFileSync(path.join(__dirname, '../lib/firebaseImageUpload.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments — the file's own docstring names makePublic() as what it replaces
  assert.ok(
    !helperSource.includes('.makePublic('),
    'uploadImageAndGetUrl must never call makePublic() — that is the exact regression this migration removes'
  );
});

test('getOrCreateDownloadUrl: backfills a token onto an object uploaded without one', async (t) => {
  if (!process.env.STORAGE_EMULATOR_HOST) {
    t.skip('requires STORAGE_EMULATOR_HOST — run via `npm run test:storage:emulator`');
    return;
  }

  const { Storage: GCSStorage } = require('@google-cloud/storage');
  const admin = require('firebase-admin');

  const PROJECT_ID = 'demo-ssbmax';
  const BUCKET = `${PROJECT_ID}.appspot.com`;

  const gcs = new GCSStorage({
    projectId: PROJECT_ID,
    apiEndpoint: process.env.STORAGE_EMULATOR_HOST,
    useAuthWithCustomEndpoint: true,
    authClient: {
      async getRequestHeaders() {
        return { Authorization: 'Bearer owner' };
      },
      projectId: PROJECT_ID,
    },
  });
  const bucket = gcs.bucket(BUCKET);

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const { getOrCreateDownloadUrl } = require('../lib/firebaseImageUpload');

  // Simulate a legacy object uploaded by the old makePublic() path: no
  // firebaseStorageDownloadTokens metadata at all (matches what Phase 5's
  // recon found for existing tat_images/ and ppdt_images/ objects).
  const destination = 'tat_images/batch_001/backfill-test-image.jpg';
  await bucket.file(destination).save(Buffer.from([0xff, 0xd8, 0xff]), {
    metadata: { contentType: 'image/jpeg' },
  });
  t.after(() => bucket.file(destination).delete());

  const [beforeMeta] = await bucket.file(destination).getMetadata();
  assert.ok(
    !beforeMeta.metadata || !beforeMeta.metadata.firebaseStorageDownloadTokens,
    'precondition: object must start with no download token'
  );

  const imageUrl = await getOrCreateDownloadUrl(bucket, destination);

  assert.ok(
    imageUrl.includes('/v0/b/') && imageUrl.includes('alt=media') && imageUrl.includes('token='),
    `imageUrl must be a download-token URL, got: ${imageUrl}`
  );

  const [afterMeta] = await bucket.file(destination).getMetadata();
  assert.ok(
    afterMeta.metadata && afterMeta.metadata.firebaseStorageDownloadTokens,
    'a firebaseStorageDownloadTokens value must have been patched onto the object'
  );

  // Calling it again for an object that already has a token must reuse it, not
  // rotate it — rotating would silently break any URL already handed out.
  const secondUrl = await getOrCreateDownloadUrl(bucket, destination);
  assert.equal(secondUrl, imageUrl, 'must reuse the existing token, not mint a new one');
});

test('getOrCreateDownloadUrl: dryRun never patches metadata on a tokenless object', async (t) => {
  if (!process.env.STORAGE_EMULATOR_HOST) {
    t.skip('requires STORAGE_EMULATOR_HOST — run via `npm run test:storage:emulator`');
    return;
  }

  const { Storage: GCSStorage } = require('@google-cloud/storage');
  const admin = require('firebase-admin');

  const PROJECT_ID = 'demo-ssbmax';
  const BUCKET = `${PROJECT_ID}.appspot.com`;

  const gcs = new GCSStorage({
    projectId: PROJECT_ID,
    apiEndpoint: process.env.STORAGE_EMULATOR_HOST,
    useAuthWithCustomEndpoint: true,
    authClient: {
      async getRequestHeaders() {
        return { Authorization: 'Bearer owner' };
      },
      projectId: PROJECT_ID,
    },
  });
  const bucket = gcs.bucket(BUCKET);

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const { getOrCreateDownloadUrl } = require('../lib/firebaseImageUpload');

  // A real backfill dry-run must be able to inspect a legacy tokenless object
  // (matches production TAT/PPDT objects found during Phase 5 recon) without
  // mutating it — this test regression-guards the bug where an earlier version
  // of this helper patched metadata unconditionally, even under --dry-run.
  const destination = 'ppdt_images/batch_001/dry-run-test-image.jpg';
  await bucket.file(destination).save(Buffer.from([0xff, 0xd8, 0xff]), {
    metadata: { contentType: 'image/jpeg' },
  });
  t.after(() => bucket.file(destination).delete());

  const result = await getOrCreateDownloadUrl(bucket, destination, { dryRun: true });
  assert.equal(result, null, 'dryRun must return null instead of minting a token');

  const [metadata] = await bucket.file(destination).getMetadata();
  assert.ok(
    !metadata.metadata || !metadata.metadata.firebaseStorageDownloadTokens,
    'dryRun must never call setMetadata on a tokenless object'
  );
});
