#!/usr/bin/env node
/**
 * Publishes `content/topics/*.md` -> Firestore `topic_content` and
 * `content/study-materials/*.md` -> Firestore `study_materials`, plus (Phase 5,
 * docs/plans/write-the-phased-plan-wobbly-pancake.md, decision D2) each file's parsed
 * `DocumentModel` -> the side collections `topic_sections` / `study_material_sections`.
 * The side documents are additive and separate: `topic_content` / `study_materials` are
 * written with the exact same shape as before this phase, so an existing GitLive decode on a
 * shipped client cannot break (D2's "risk elimination" reasoning) -- see
 * content-publish.emulator.test.js's byte-identical assertion.
 *
 * Git is the authoring source, Firestore is the distribution channel
 * (BLOCKER 3, docs/plans/i-just-watched-a-nested-russell.md). Run this
 * after editing content/ — KMP reads Firestore at runtime, so mobile
 * picks up changes without an app release.
 *
 * Validate -> Preview -> Upload, per scripts/CLAUDE.md: dry-run by default,
 * pass --write to actually push.
 */

const fs = require('fs');
const path = require('path');
const { parseContentFile, assertPublishable } = require('./parseContentFile');
const { parseDocument } = require('./parseDocument');

const ROOT = path.resolve(__dirname, '..', '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');
const MATERIALS_DIR = path.join(ROOT, 'content', 'study-materials');
const CONTENT_DIR = path.join(ROOT, 'content');
const SLUGS_LOCK_PATH = path.join(CONTENT_DIR, 'slugs.lock.json');

function loadDir(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const sourcePath = path.join(dir, f);
      const parsed = parseContentFile(fs.readFileSync(sourcePath, 'utf8'), sourcePath);
      return { sourcePath, id: path.basename(f, '.md'), ...parsed };
    });
}

/**
 * Firestore rejects a directly-nested array (an array whose elements are themselves arrays --
 * "Property array contains an invalid nested entity"). `table` blocks are the only place
 * parseDocument.js produces one (`rows: string[][]`, see content/SCHEMA.md). Wrapping each row
 * in `{ cells }` keeps every array Firestore sees single-level; the KMP/web readers unwrap it
 * back to `rows: string[][]` (see StudyContentSectionsDto.kt's `TableBlockDto`).
 */
function sanitizeForFirestore(model) {
  return {
    sections: model.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) =>
        block.type === 'table' ? { ...block, rows: block.rows.map((cells) => ({ cells })) } : block
      ),
    })),
  };
}

function buildDocs() {
  const slugsLock = JSON.parse(fs.readFileSync(SLUGS_LOCK_PATH, 'utf8'));
  const docs = [];
  const errors = [];
  const collect = (entries, collection, field, sectionsCollection) => {
    for (const { sourcePath, id, meta, body } of entries) {
      try {
        assertPublishable({ body }, sourcePath);
        docs.push({ collection, id, data: { ...meta, [field]: body } });
        const relPath = path.relative(CONTENT_DIR, sourcePath);
        docs.push({
          collection: sectionsCollection,
          id,
          data: sanitizeForFirestore(parseDocument(body, { sourcePath: relPath, existingSlugs: slugsLock })),
        });
      } catch (e) {
        errors.push(e.message);
      }
    }
  };
  collect(loadDir(TOPICS_DIR), 'topic_content', 'introduction', 'topic_sections');
  collect(loadDir(MATERIALS_DIR), 'study_materials', 'contentMarkdown', 'study_material_sections');
  return { docs, errors };
}

/** Writes `docs` (as built by buildDocs()) to Firestore via `db`, respecting the 500-write batch limit. */
async function publishDocs(db, docs) {
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 500)) {
      batch.set(db.collection(doc.collection).doc(doc.id), doc.data, { merge: false });
    }
    await batch.commit();
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const { docs, errors } = buildDocs();

  console.log(`Parsed ${docs.length + errors.length} content files: ${docs.length} publishable, ${errors.length} invalid.`);
  if (errors.length) {
    console.log('\nInvalid (excluded from publish):');
    errors.forEach((msg) => console.log(`  - ${msg}`));
  }

  if (!write) {
    console.log('\nDry run — no writes made. Pass --write to publish to Firestore.');
    for (const doc of docs) {
      if (doc.data.sections) {
        console.log(`  [dry-run] ${doc.collection}/${doc.id} — ${doc.data.sections.length} section(s)`);
      } else {
        const bodyLen = (doc.data.introduction ?? doc.data.contentMarkdown ?? '').length;
        console.log(`  [dry-run] ${doc.collection}/${doc.id} — ${bodyLen} chars`);
      }
    }
    return;
  }

  if (errors.length) {
    console.error(`\nRefusing to publish: ${errors.length} file(s) failed validation. Fix them or run without --write to preview.`);
    process.exit(1);
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIRESTORE_PROJECT_ID || 'ssbmax-49e68' });
  }
  await publishDocs(admin.firestore(), docs);
  console.log(`\nPublished ${docs.length} documents to Firestore.`);
}

module.exports = { buildDocs, publishDocs };

if (require.main === module) {
  main().catch((e) => {
    console.error('publishContent failed:', e.message);
    process.exit(1);
  });
}
