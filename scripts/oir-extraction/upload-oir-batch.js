/**
 * Upload one deterministic OIR batch (figures -> Storage, questions -> Firestore).
 *
 * Usage:
 *   node upload-oir-batch.js batch_pdf_001            # live upload
 *   node upload-oir-batch.js batch_pdf_001 --dry-run  # offline validation only
 *   node upload-oir-batch.js batch_pdf_001 --verify   # HEAD-check all questionImageUrls in Firestore
 *   node upload-oir-batch.js batch_pdf_001 --repair   # re-upload missing images + patch gs:// placeholders
 *
 * Live upload requires (same as the other scripts in ../):
 *   - npm install  (in SSBMax/scripts/ — firebase-admin, uuid)
 *   - service account at SSBMax/.firebase/service-account.json
 *
 * Reuses conventions from ../upload-gpe-images.js (Storage) and
 * ../upload-oir-batch-002.js (Firestore test_content/oir/batches/{batchId}).
 */

const fs = require('fs');
const path = require('path');

const BUCKET = 'ssbmax-49e68.firebasestorage.app';
const STORAGE_DIR = 'oir/pdf_questions';
const OUT_DIR = process.env.OIR_OUT_DIR || path.join(__dirname, 'out');
const IMG_DIR = path.join(OUT_DIR, 'images');

const batchId = process.argv[2];
const dryRun   = process.argv.includes('--dry-run');
const verify   = process.argv.includes('--verify');
const repair   = process.argv.includes('--repair');

if (!batchId) {
  console.error('❌ Usage: node upload-oir-batch.js <batchId> [--dry-run]');
  process.exit(1);
}

const batchPath = path.join(OUT_DIR, `${batchId}.json`);
if (!fs.existsSync(batchPath)) {
  console.error(`❌ Batch JSON not found: ${batchPath}`);
  console.error('   Generate it first: python3 oir_extract_v2.py --set N');
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

/**
 * Ingestion gate — fail-closed write-time enforcement of the SAME structural
 * invariants that the runtime Kotlin validator treats as ERRORS. The Kotlin
 * domain validator remains the single source of truth for the *rules*; this is
 * the write-time enforcement of them, so a bad batch can never reach Firestore
 * (and therefore never silently degrade an assembled test).
 *
 * Rule ↔ validator mapping (core/domain/.../validation/OIRQuestionValidator.kt,
 * validate(); warnings there are tolerated here, only errors block):
 *   id blank ......................... "Question ID is blank"
 *   questionNumber <= 0 .............. "Invalid question number"
 *   questionText blank ............... "Question text is empty or blank"
 *   questionText has raw JSON ........ "Question text contains raw JSON"
 *   options empty .................... "No options provided"
 *   duplicate option ids ............. "Duplicate option IDs found"
 *   option id blank / single-letter .. "Option #n has blank/single-letter ID"
 *   option text blank & no image ..... "Option 'x' has empty text and no image"
 *   correctAnswerId blank ............ "CorrectAnswerId is empty"
 *        (allowed iff questionImageUrl present + options non-empty — the
 *         multi-answer figure-question exception)
 *   correctAnswerId single-letter .... "CorrectAnswerId is single letter"
 *   correctAnswerId opt_<n>_<x> ...... "CorrectAnswerId has question number embedded"
 *   correctAnswerId ∉ option ids ..... "does not match any option ID"
 *   timeSeconds <= 0 ................. "Time allocation invalid"
 */
function validateBatch(b) {
  const errors = [];
  for (const q of b.questions) {
    const id = (q.id || '').trim();
    const push = (msg) => errors.push(`${id || '(no id)'}: ${msg}`);
    if (!id) push('Question ID is blank');
    if (!(q.questionNumber > 0)) push(`Invalid question number: ${q.questionNumber}`);
    const text = q.questionText || '';
    if (!text.trim()) push('Question text is empty or blank');
    if (text.toLowerCase().includes('"question":')) push('Question text contains raw JSON');

    const opts = q.options || [];
    if (opts.length === 0) push('No options provided');
    const optIds = opts.map((o) => o.id);
    const dups = [...new Set(optIds.filter((x, i) => optIds.indexOf(x) !== i))];
    if (dups.length) push(`Duplicate option IDs: ${dups.join(', ')}`);
    opts.forEach((o, i) => {
      if (!o.id || !o.id.trim()) push(`Option #${i + 1} has blank ID`);
      else if (/^[a-dA-D]$/.test(o.id)) push(`Option #${i + 1} has single-letter ID '${o.id}'`);
      if ((!o.text || !o.text.trim()) && !o.imageUrl) push(`Option '${o.id}' has empty text and no image`);
    });

    const ca = (q.correctAnswerId || '').trim();
    const isMultiAnswerFigure = !ca && q.questionImageUrl && opts.length > 0;
    if (!ca && !isMultiAnswerFigure) push('CorrectAnswerId is empty');
    else if (ca) {
      if (/^[a-dA-D]$/.test(ca)) push(`CorrectAnswerId is single letter '${ca}'`);
      else if (/^opt_\d+_[a-d]$/.test(ca)) push(`CorrectAnswerId has question number embedded: '${ca}'`);
      if (!opts.some((o) => o.id === ca)) push(`CorrectAnswerId '${ca}' does not match any option ID`);
    }

    if (!(q.timeSeconds > 0)) push(`Time allocation invalid: ${q.timeSeconds}`);
  }
  return errors;
}

const validationErrors = validateBatch(batch);
if (validationErrors.length) {
  console.error(`❌ INGESTION GATE REJECTED ${batchId} — ${validationErrors.length} invalid question(s):`);
  validationErrors.slice(0, 40).forEach((e) => console.error(`   ${e}`));
  if (validationErrors.length > 40) console.error(`   ... and ${validationErrors.length - 40} more`);
  process.exit(1);
}
console.log(`🔒 Ingestion gate: all ${batch.questions.length} questions pass structural validation.`);

/**
 * Non-blocking figure check (the class of bug that shipped the missing cube-question
 * image). NOT a hard gate: `OIRQuestionType` (shared/.../domain/model/OIRTest.kt) has
 * only 4 broad values — VERBAL_REASONING, NON_VERBAL_REASONING, NUMERICAL_ABILITY,
 * SPATIAL_REASONING — and neither the extractor (oir_extract_v2.py/oir_extract_part3.py)
 * nor the Kotlin validator enforces a strict type -> questionImageUrl invariant: mixed
 * batches legitimately contain NON_VERBAL_REASONING/SPATIAL_REASONING questions with no
 * diagram. Blocking on this would reject valid batches, so it's a warning for manual
 * review, not an ingestion-gate failure.
 */
const FIGURE_LIKELY_TYPES = new Set(['NON_VERBAL_REASONING', 'SPATIAL_REASONING']);
const suspectMissingFigure = batch.questions.filter(
  (q) => FIGURE_LIKELY_TYPES.has(q.type) && !q.questionImageUrl
);
if (suspectMissingFigure.length) {
  console.warn(`⚠️  ${suspectMissingFigure.length} question(s) are ${[...FIGURE_LIKELY_TYPES].join('/')} with no questionImageUrl — verify these aren't missing a diagram:`);
  suspectMissingFigure.forEach((q) => console.warn(`   ${q.id} (${q.type})`));
}

// Collect the figure files referenced by this batch and validate they exist locally.
const figures = [];
let missing = [];
for (const q of batch.questions) {
  if (!q.questionImageUrl) continue;
  const file = q.questionImageUrl.split('/').pop();
  const local = path.join(IMG_DIR, file);
  if (!fs.existsSync(local)) missing.push(file);
  else figures.push({ file, local });
}

console.log(`📦 ${batchId}: ${batch.questions.length} questions, ${figures.length} figures`);
if (missing.length) {
  console.error(`❌ Missing local image files (re-run the extractor): ${missing.join(', ')}`);
  process.exit(1);
}

async function main() {
  if (dryRun) {
    console.log('🧪 DRY RUN — no uploads, no Firestore writes.');
    console.log(`   Would upload ${figures.length} figures to gs://${BUCKET}/${STORAGE_DIR}/`);
    if (figures[0]) console.log(`   Sample storage path: ${STORAGE_DIR}/${figures[0].file}`);
    console.log(`   Would write Firestore doc: test_content/oir/batches/${batchId}`);
    const types = batch.questions.reduce((a, q) => ((a[q.type] = (a[q.type] || 0) + 1), a), {});
    console.log('   Question types:', types);
    console.log('✅ Dry run OK.');
    return;
  }

  // ---- shared Firebase initialisation (used by live upload, verify, and repair)
  const admin = require('firebase-admin');
  const { getDownloadURL } = require('firebase-admin/storage');
  const { uploadImageAndGetUrl } = require('../lib/firebaseImageUpload');
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(process.env.HOME, 'Downloads/SSBMax/firebase-admin-key.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account not found at ${serviceAccountPath}`);
    console.error('   Set FIREBASE_SERVICE_ACCOUNT=/path/to/key.json');
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: BUCKET,
  });
  const bucket = admin.storage().bucket(BUCKET);
  const db = admin.firestore();
  const docRef = db.collection('test_content').doc('oir').collection('batches').doc(batchId);

  // ---- --verify: HEAD-check every questionImageUrl already written to Firestore
  if (verify) {
    console.log(`🔍 Verifying image URLs for ${batchId}...`);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.error(`❌ Firestore doc not found: test_content/oir/batches/${batchId}`);
      process.exit(1);
    }
    const https = require('https');
    const questions = snap.data().questions || [];
    const broken = [];
    for (const q of questions) {
      if (!q.questionImageUrl) continue;
      const ok = await new Promise((resolve) => {
        const req = https.request(q.questionImageUrl, { method: 'HEAD' }, (res) => resolve(res.statusCode === 200));
        req.on('error', () => resolve(false));
        req.end();
      });
      if (!ok) broken.push({ id: q.id, url: q.questionImageUrl });
    }
    if (broken.length > 0) {
      console.error(`❌ VERIFY FAILED — ${broken.length} broken image URL(s):`);
      broken.forEach((b) => console.error(`   ${b.id}: ${b.url}`));
      console.error('   Run with --repair to re-upload missing images and patch Firestore.');
      process.exit(1);
    }
    console.log(`✅ VERIFY OK — all ${questions.filter((q) => q.questionImageUrl).length} image URLs resolve.`);
    return;
  }

  // ---- --repair: re-upload only the images whose Storage objects are missing, then patch Firestore
  if (repair) {
    console.log(`🔧 Repair mode — re-uploading missing images for ${batchId}...`);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.error(`❌ Firestore doc not found — run a full upload first.`);
      process.exit(1);
    }
    const storedQuestions = snap.data().questions || [];
    let repaired = 0;
    const urlByFile = {};
    for (const { file, local } of figures) {
      const destination = `${STORAGE_DIR}/${file}`;
      const [exists] = await bucket.file(destination).exists();
      if (!exists) {
        const { imageUrl } = await uploadImageAndGetUrl(bucket, local, destination, 'image/png');
        urlByFile[file] = imageUrl;
        console.log(`   ✅ Re-uploaded: ${file}`);
        repaired++;
      } else {
        urlByFile[file] = await getDownloadURL(bucket.file(destination));
      }
    }
    if (repaired === 0) {
      console.log('   ℹ️  All images already present in Storage — no re-uploads needed.');
    }
    // Patch any placeholder gs:// URLs (and add storagePath) still in the stored questions
    let patched = false;
    for (const q of storedQuestions) {
      if (q.questionImageUrl && q.questionImageUrl.startsWith('gs://')) {
        const file = q.questionImageUrl.split('/').pop();
        if (urlByFile[file]) {
          q.questionImageUrl = urlByFile[file];
          q.questionImageStoragePath = `${STORAGE_DIR}/${file}`;
          patched = true;
        }
      }
    }
    if (patched) {
      await docRef.update({ questions: storedQuestions });
      console.log('   ✅ Patched gs:// placeholder URLs in Firestore.');
    }
    console.log(`✅ Repair complete (${repaired} image(s) re-uploaded).`);
    return;
  }

  // ---- live upload
  console.log(`📤 Uploading ${figures.length} figures...`);
  const urlByFile = {};
  for (const { file, local } of figures) {
    const destination = `${STORAGE_DIR}/${file}`;
    const { imageUrl } = await uploadImageAndGetUrl(bucket, local, destination, 'image/png');
    urlByFile[file] = imageUrl;
  }
  console.log('   ✅ Figures uploaded.');

  // Rewrite questionImageUrl placeholders to download-token URLs, and add storagePath.
  for (const q of batch.questions) {
    if (q.questionImageUrl) {
      const file = q.questionImageUrl.split('/').pop();
      q.questionImageUrl = urlByFile[file];
      q.questionImageStoragePath = `${STORAGE_DIR}/${file}`;
    }
  }

  await docRef.set({
    batchId: batch.batchId,
    version: batch.version,
    source: batch.source,
    totalQuestions: batch.totalQuestions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    questions: batch.questions,
  });
  console.log(`✅ Firestore: test_content/oir/batches/${batchId} (${batch.totalQuestions} questions)`);
  console.log(`   Run with --verify to confirm all image URLs resolve.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('💥', e); process.exit(1); });
