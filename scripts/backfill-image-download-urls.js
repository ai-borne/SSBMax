#!/usr/bin/env node

/**
 * Phase 5 of the OIR/GPE/TAT/PPDT image-CSP migration (docs/plans/fuzzy-dreaming-storm.md).
 *
 * Existing Firestore docs still hold pre-migration `storage.googleapis.com` image URLs,
 * which web's CSP img-src blocks (only `firebasestorage.googleapis.com` is allowlisted).
 * This is a backfill, not a re-upload: the Storage objects already exist, so this script
 * derives each object's path from its current public URL, ensures it has a
 * `firebaseStorageDownloadTokens` value (patching one on if missing — OIR/GPE objects
 * already have one; TAT/PPDT objects don't, confirmed during Phase 5 recon), and writes
 * the resulting download-token URL (+ a storagePath field) back to Firestore.
 *
 * This step does NOT touch the objects' existing public ACL — that revocation is a
 * separate, explicitly-confirmed step (see revoke-public-image-acls.js) run only after
 * both platforms are confirmed rendering the new URLs.
 *
 * Usage:
 *   node backfill-image-download-urls.js --type=oir              # dry-run (default)
 *   node backfill-image-download-urls.js --type=oir --live       # write to Firestore
 *   node backfill-image-download-urls.js --type=gpe|tat|ppdt [--live]
 */

const admin = require('firebase-admin');
const serviceAccount = require('../.firebase/service-account.json');
const { getOrCreateDownloadUrl } = require('./lib/firebaseImageUpload');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ssbmax-49e68.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const live = process.argv.includes('--live');
const typeArg = process.argv.find((a) => a.startsWith('--type='));
const type = typeArg ? typeArg.split('=')[1] : null;

/** Extracts the object path from an old `https://storage.googleapis.com/{bucket}/{path}` URL. */
function storagePathFromPublicUrl(url) {
  const prefix = `https://storage.googleapis.com/${bucket.name}/`;
  if (!url || !url.startsWith(prefix)) return null;
  return decodeURIComponent(url.slice(prefix.length));
}

async function backfillOIR() {
  const batchesRef = db.collection('test_content').doc('oir').collection('batches');
  const snap = await batchesRef.get();
  let patchedDocs = 0;
  let patchedImages = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const questions = data.questions || [];
    let changed = false;

    for (const q of questions) {
      const storagePath = storagePathFromPublicUrl(q.questionImageUrl);
      if (!storagePath) {
        if (q.questionImageUrl) skipped++;
        continue;
      }
      const newUrl = await getOrCreateDownloadUrl(bucket, storagePath, { dryRun: !live });
      q.questionImageUrl = newUrl;
      q.questionImageStoragePath = storagePath;
      changed = true;
      patchedImages++;
    }

    if (changed) {
      patchedDocs++;
      console.log(`  ${live ? 'Patching' : '[DRY RUN] Would patch'}: ${doc.id} (${questions.filter((q) => q.questionImageStoragePath).length} images)`);
      if (live) {
        await batchesRef.doc(doc.id).update({ questions });
      }
    }
  }

  console.log(`\nOIR: ${patchedDocs} batch doc(s), ${patchedImages} image(s) ${live ? 'patched' : 'would be patched'}. ${skipped} already non-public-URL (skipped).`);
}

async function backfillGPE() {
  const scenariosRef = db.collection('gpe_scenarios');
  const snap = await scenariosRef.get();
  let patched = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const storagePath = storagePathFromPublicUrl(data.imageUrl);
    if (!storagePath) {
      if (data.imageUrl) skipped++;
      continue;
    }
    const newUrl = await getOrCreateDownloadUrl(bucket, storagePath, { dryRun: !live });
    console.log(`  ${live ? 'Patching' : '[DRY RUN] Would patch'}: ${doc.id} -> ${storagePath}`);
    if (live) {
      await scenariosRef.doc(doc.id).update({ imageUrl: newUrl, imageStoragePath: storagePath });
    }
    patched++;
  }

  console.log(`\nGPE: ${patched} doc(s) ${live ? 'patched' : 'would be patched'}. ${skipped} already non-public-URL (skipped).`);
}

async function backfillBatchDoc(docPath, label) {
  const ref = db.doc(docPath);
  const doc = await ref.get();
  if (!doc.exists) {
    console.log(`${label}: document not found at ${docPath}`);
    return;
  }
  const data = doc.data();
  const images = data.images || [];
  let patched = 0;
  let skipped = 0;

  for (const img of images) {
    const storagePath = storagePathFromPublicUrl(img.imageUrl);
    if (!storagePath) {
      if (img.imageUrl) skipped++;
      continue;
    }
    const newUrl = await getOrCreateDownloadUrl(bucket, storagePath, { dryRun: !live });
    img.imageUrl = newUrl;
    img.storagePath = storagePath;
    patched++;
  }

  console.log(`  ${live ? 'Patching' : '[DRY RUN] Would patch'}: ${docPath} (${patched} image(s))`);
  if (live && patched > 0) {
    await ref.update({ images });
  }

  console.log(`\n${label}: ${patched} image(s) ${live ? 'patched' : 'would be patched'} out of ${images.length}. ${skipped} already non-public-URL (skipped).`);
}

async function main() {
  if (!type) {
    console.error('Usage: node backfill-image-download-urls.js --type=oir|gpe|tat|ppdt [--live]');
    process.exit(1);
  }
  console.log(`${live ? '🔴 LIVE RUN' : '🔎 DRY RUN'} — backfilling ${type.toUpperCase()} image URLs\n`);

  if (type === 'oir') await backfillOIR();
  else if (type === 'gpe') await backfillGPE();
  else if (type === 'tat') await backfillBatchDoc('test_content/tat/image_batches/batch_001', 'TAT');
  else if (type === 'ppdt') await backfillBatchDoc('test_content/ppdt/image_batches/batch_001', 'PPDT');
  else {
    console.error(`Unknown --type=${type}. Must be one of: oir, gpe, tat, ppdt`);
    process.exit(1);
  }

  if (!live) {
    console.log('\nDry run only — no writes made. Re-run with --live to apply.');
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
