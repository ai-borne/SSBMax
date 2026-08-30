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
  // public. What makePublic() actually does is grant a GCS *object ACL*
  // (`allUsers:objectViewer`); assert that ACL was never granted.
  const [metadata] = await bucket.file(destination).getMetadata();
  const acl = metadata.acl || [];
  assert.ok(
    !acl.some((entry) => entry.entity === 'allUsers'),
    'uploaded object must not carry an allUsers ACL entry (i.e. must not be public via makePublic())'
  );
});
