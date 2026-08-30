/**
 * Single upload path for every content-image script (OIR/GPE/TAT/PPDT).
 *
 * Replaces the old `bucket.file(path).makePublic()` + hand-built
 * `https://storage.googleapis.com/...` URL pattern duplicated across all 12 upload
 * scripts. That pattern (a) got silently blocked by web's CSP, which only allowlists
 * `firebasestorage.googleapis.com`, and (b) granted GCS object-level ACL
 * (`allUsers:objectViewer`), bypassing `storage.rules` entirely.
 *
 * Every script already sets `firebaseStorageDownloadTokens` metadata on upload — this
 * just uses `firebase-admin/storage`'s official `getDownloadURL()` to turn that token
 * into a URL that matches the CSP allowlist and the CSP-compliant, storage.rules-gated
 * shape, instead of discarding it in favor of `makePublic()`.
 */

const { v4: uuidv4 } = require('uuid');
const { getDownloadURL } = require('firebase-admin/storage');

/**
 * Uploads a local file to Storage and returns its download-token URL plus the object
 * path, so callers can write both `imageUrl` and `storagePath` on the Firestore doc.
 *
 * @param {import('firebase-admin/storage').Bucket} bucket
 * @param {string} localPath - path to the file on disk
 * @param {string} destination - object path within the bucket, e.g. `oir/pdf_questions/foo.png`
 * @param {string} contentType - e.g. `image/png`
 * @returns {Promise<{ imageUrl: string, storagePath: string }>}
 */
async function uploadImageAndGetUrl(bucket, localPath, destination, contentType) {
  const [file] = await bucket.upload(localPath, {
    destination,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: uuidv4() },
    },
  });

  const imageUrl = await getDownloadURL(file);
  return { imageUrl, storagePath: destination };
}

/**
 * Backfill helper: for an object already sitting in Storage (no re-upload), ensures
 * it has a `firebaseStorageDownloadTokens` value — generating and patching one via
 * `setMetadata` if missing — then returns its download-token URL. Used to migrate
 * pre-existing `storage.googleapis.com` records to the CSP-allowlisted host without
 * touching object bytes or the existing public ACL (that revocation is a deliberate,
 * separate step — see docs/plans/fuzzy-dreaming-storm.md Phase 5).
 *
 * @param {import('firebase-admin/storage').Bucket} bucket
 * @param {string} storagePath - existing object path within the bucket
 * @param {{ dryRun?: boolean }} [options] - dryRun: true inspects only, never calls
 *   setMetadata, and returns null if no token exists yet (so callers can report
 *   "would patch" without actually mutating Storage).
 * @returns {Promise<string | null>} the download-token URL, or null in dry-run mode
 *   when no token exists yet
 */
async function getOrCreateDownloadUrl(bucket, storagePath, options = {}) {
  const file = bucket.file(storagePath);
  const [metadata] = await file.getMetadata();
  const hasToken = !!(metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens);

  if (!hasToken) {
    if (options.dryRun) return null;
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: uuidv4() } });
  }
  return getDownloadURL(file);
}

module.exports = { uploadImageAndGetUrl, getOrCreateDownloadUrl };
