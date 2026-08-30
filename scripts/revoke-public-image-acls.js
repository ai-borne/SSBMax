#!/usr/bin/env node

/**
 * Phase 5, final step of the OIR/GPE/TAT/PPDT image-CSP migration
 * (docs/plans/fuzzy-dreaming-storm.md). Revokes the `allUsers:objectViewer` GCS ACL
 * that the old makePublic()-based upload scripts granted, so read access is governed
 * by storage.rules (auth required) instead of a public object ACL that bypassed it.
 *
 * This is the actual security fix and the point of no return for this migration —
 * run only after backfill-image-download-urls.js --live has patched Firestore for a
 * type AND both web and KMP have been confirmed rendering the new URLs.
 *
 * Usage:
 *   node revoke-public-image-acls.js --type=oir              # dry-run (default)
 *   node revoke-public-image-acls.js --type=oir --live       # actually revoke
 *   node revoke-public-image-acls.js --type=gpe|tat|ppdt [--live]
 */

const admin = require('firebase-admin');
const serviceAccount = require('../.firebase/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ssbmax-49e68.firebasestorage.app',
});

const bucket = admin.storage().bucket();

const live = process.argv.includes('--live');
const typeArg = process.argv.find((a) => a.startsWith('--type='));
const type = typeArg ? typeArg.split('=')[1] : null;

const PREFIXES = {
  oir: 'oir/pdf_questions/',
  gpe: ['gpe_images/', 'gto/gpe/images/'],
  tat: 'tat_images/',
  ppdt: 'ppdt_images/',
};

async function revokePrefix(prefix) {
  const [files] = await bucket.getFiles({ prefix });
  let revoked = 0;
  let alreadyPrivate = 0;
  let failed = 0;

  for (const file of files) {
    // file.getMetadata() does NOT reliably return the `acl` array for this bucket
    // (fine-grained ACLs, not uniform bucket-level access) — confirmed by cross-
    // checking against `gcloud storage objects describe`, which does show an
    // `allUsers: READER` entry that getMetadata()'s response omits. file.acl.get()
    // is the correct ACL sub-resource call.
    const [acl] = await file.acl.get();
    const isPublic = acl.some((entry) => entry.entity === 'allUsers');

    if (!isPublic) {
      alreadyPrivate++;
      continue;
    }

    console.log(`  ${live ? 'Revoking' : '[DRY RUN] Would revoke'}: ${file.name}`);
    if (live) {
      try {
        await file.makePrivate();
        revoked++;
      } catch (error) {
        console.error(`    ❌ Failed: ${error.message}`);
        failed++;
      }
    } else {
      revoked++;
    }
  }

  return { total: files.length, revoked, alreadyPrivate, failed };
}

async function main() {
  if (!type || !PREFIXES[type]) {
    console.error('Usage: node revoke-public-image-acls.js --type=oir|gpe|tat|ppdt [--live]');
    process.exit(1);
  }
  console.log(`${live ? '🔴 LIVE RUN — REVOKING PUBLIC ACL' : '🔎 DRY RUN'} for ${type.toUpperCase()}\n`);

  const prefixes = Array.isArray(PREFIXES[type]) ? PREFIXES[type] : [PREFIXES[type]];
  let grandTotal = { total: 0, revoked: 0, alreadyPrivate: 0, failed: 0 };

  for (const prefix of prefixes) {
    console.log(`--- ${prefix} ---`);
    const result = await revokePrefix(prefix);
    grandTotal.total += result.total;
    grandTotal.revoked += result.revoked;
    grandTotal.alreadyPrivate += result.alreadyPrivate;
    grandTotal.failed += result.failed;
  }

  console.log(`\n${type.toUpperCase()}: ${grandTotal.total} object(s) scanned. ${grandTotal.revoked} ${live ? 'revoked' : 'would be revoked'}, ${grandTotal.alreadyPrivate} already private, ${grandTotal.failed} failed.`);

  if (!live) {
    console.log('\nDry run only — no ACLs changed. Re-run with --live to apply.');
  }
  process.exit(grandTotal.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Revocation failed:', error);
  process.exit(1);
});
