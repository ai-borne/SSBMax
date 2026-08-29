#!/usr/bin/env node
/**
 * Reads every content/{topics,study-materials}/*.md (+ faq.md), runs parseDocument.js over
 * each, and writes/updates content/slugs.lock.json — the checked-in slug pin file Phase 3's
 * heading rewrite depends on (see docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 1).
 *
 * Run with --check to verify the committed lockfile is up to date without writing (used in CI /
 * npm run build); without a flag it writes content/slugs.lock.json in place.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseContentFile } = require('./parseContentFile');
const { parseDocument } = require('./parseDocument');

const CONTENT_ROOT = path.join(__dirname, '..', '..', 'content');
const LOCK_PATH = path.join(CONTENT_ROOT, 'slugs.lock.json');

function collectFiles() {
  const files = [];
  for (const dir of ['topics', 'study-materials']) {
    const d = path.join(CONTENT_ROOT, dir);
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.md')) files.push(path.relative(CONTENT_ROOT, path.join(d, f)));
    }
  }
  files.push('faq.md');
  return files.sort();
}

function loadExistingLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function buildLock() {
  const existing = loadExistingLock();
  const next = {};
  for (const relPath of collectFiles()) {
    const sourcePath = path.join(CONTENT_ROOT, relPath);
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const { body } = parseContentFile(raw, sourcePath);
    // Slug identity keys are relative-path based so the lockfile is portable across machines.
    const relExisting = {};
    for (const [k, v] of Object.entries(existing)) {
      if (k.startsWith(`${relPath}#`)) relExisting[k.replace(relPath, sourcePath)] = v;
    }
    const { sections } = parseDocument(body, { sourcePath, existingSlugs: relExisting });
    for (const section of sections) {
      next[section.id.replace(sourcePath, relPath)] = section.slug;
    }
  }
  return next;
}

function main() {
  const check = process.argv.includes('--check');
  const next = buildLock();
  const nextJson = `${JSON.stringify(next, null, 2)}\n`;
  if (check) {
    const current = fs.existsSync(LOCK_PATH) ? fs.readFileSync(LOCK_PATH, 'utf8') : '';
    if (current !== nextJson) {
      console.error('content/slugs.lock.json is out of date. Run `node scripts/content/buildSlugLock.js` to update it.');
      process.exit(1);
    }
    console.log('content/slugs.lock.json is up to date.');
    return;
  }
  fs.writeFileSync(LOCK_PATH, nextJson);
  console.log(`Wrote ${Object.keys(next).length} slug(s) to ${LOCK_PATH}`);
}

if (require.main === module) main();

module.exports = { buildLock, CONTENT_ROOT, LOCK_PATH };
