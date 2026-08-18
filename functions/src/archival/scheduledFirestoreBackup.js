/**
 * Scheduled Firestore backup (Phase 5, cost & scale guardrails).
 *
 * There is no backup of the production Firestore database anywhere today -- a bad migration,
 * a bug in a batch write, or an admin mistake is unrecoverable. This exports the full database
 * to a GCS bucket daily via the Firestore Admin API's managed export (the same mechanism behind
 * `gcloud firestore export`), which is an async long-running operation Google runs server-side --
 * this function only has to kick it off, not wait for it.
 *
 * User-action prerequisite (cannot be done from this codebase, see the phase's console-steps
 * writeup): a GCS bucket must exist to receive exports, and the Cloud Functions service account
 * needs the "Cloud Datastore Import Export Admin" IAM role. Bucket name comes from
 * FIRESTORE_BACKUP_BUCKET (functions/.env.<project-id>), not hardcoded, since it differs per
 * project the same way GEMINI_API_KEY does.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { v1: firestoreAdminV1 } = require('@google-cloud/firestore');

if (!admin.apps.length) {
  admin.initializeApp();
}

const adminClient = new firestoreAdminV1.FirestoreAdminClient();

/**
 * Builds the export request body -- pure and separately testable from the actual gRPC call.
 * `collectionIds: []` means "export every collection," matching `gcloud firestore export`'s
 * default with no --collection-ids flag.
 */
function buildExportRequest(projectId, bucketName, timestamp = Date.now()) {
  return {
    name: adminClient.databasePath(projectId, '(default)'),
    outputUriPrefix: `gs://${bucketName}/firestore-backups/${timestamp}`,
    collectionIds: []
  };
}

exports.scheduledFirestoreBackup = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const bucketName = process.env.FIRESTORE_BACKUP_BUCKET;
  if (!bucketName) {
    console.error('[scheduledFirestoreBackup] FIRESTORE_BACKUP_BUCKET is not set -- skipping backup');
    return null;
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const request = buildExportRequest(projectId, bucketName);

  try {
    const [operation] = await adminClient.exportDocuments(request);
    console.log(`[scheduledFirestoreBackup] export started: ${operation.name} -> ${request.outputUriPrefix}`);
  } catch (error) {
    console.error(`[scheduledFirestoreBackup] export failed to start: ${error.message}`);
  }

  return null;
});

exports.buildExportRequest = buildExportRequest;
