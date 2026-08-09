/**
 * Publish the OIR content-version meta doc that drives client reconciliation.
 *
 * Writes `test_content/oir/meta/config` = { contentVersion, batchCount }.
 * OIRQuestionCacheManager.initialSync() reads this: when contentVersion differs
 * from a device's locally-stored version it clears and re-downloads all
 * `batch_pdf_001..{batchCount}`, so every install (existing ones included)
 * self-heals to the current content. Bump contentVersion whenever the served
 * bank changes; update batchCount when batches are added/removed.
 *
 * Usage:
 *   node set-oir-meta-config.js                       # DRY RUN (default)
 *   node set-oir-meta-config.js --commit              # write the meta doc
 *   node set-oir-meta-config.js --version 4 --batches 28 [--commit]
 *
 * Defaults: contentVersion=4, batchCount=28 (20 practice + 8 topic-family batches).
 * A committed target lower than the current remote version is rejected.
 * Live write requires the service account (~/Downloads/SSBMax/firebase-admin-key.json
 * or FIREBASE_SERVICE_ACCOUNT=/path).
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};
const contentVersion = flag('--version', 4);
const batchCount = flag('--batches', 28);

if (!Number.isInteger(contentVersion) || contentVersion < 1 ||
    !Number.isInteger(batchCount) || batchCount < 1) {
  console.error('❌ --version and --batches must be positive integers');
  process.exit(1);
}

async function main() {
  if (!commit) {
    console.log(`Target meta: { contentVersion: ${contentVersion}, batchCount: ${batchCount} }`);
    console.log('🧪 DRY RUN (default) — no credentials, network, or write required.');
    console.log('   Re-run with --commit to read the current remote version and publish.');
    return;
  }

  const admin = require('firebase-admin');
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(process.env.HOME, 'Downloads/SSBMax/firebase-admin-key.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account not found at ${serviceAccountPath}`);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
  const db = admin.firestore();
  const ref = db.collection('test_content').doc('oir').collection('meta').doc('config');

  const current = await ref.get();
  console.log(`Current meta: ${current.exists ? JSON.stringify(current.data()) : '(none)'}`);
  console.log(`Target  meta: { contentVersion: ${contentVersion}, batchCount: ${batchCount} }`);

  const currentVersion = current.exists ? current.data().contentVersion : null;
  if (commit && Number.isInteger(currentVersion) && contentVersion < currentVersion) {
    throw new Error(`Refusing metadata downgrade from contentVersion ${currentVersion} to ${contentVersion}`);
  }

  // These fields are the metadata SSOT consumed by operators and clients. Keep
  // merge:true so unrelated legacy fields remain available during migration, but
  // always correct the fields owned by this publisher in the same auditable write.
  await ref.set({
    contentVersion,
    batchCount,
    batches: batchCount,
    total_questions: 1255,
    distribution: {
      VERBAL_REASONING: 20,
      NON_VERBAL_REASONING: 20,
      NUMERICAL_ABILITY: 10,
      SPATIAL_REASONING: admin.firestore.FieldValue.delete(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✅ Wrote test_content/oir/meta/config = { contentVersion: ${contentVersion}, batchCount: ${batchCount} }`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('💥', e); process.exit(1); });
