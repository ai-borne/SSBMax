/**
 * Tests for scripts/content/parseDocument.js — the one markdown -> DocumentModel parser
 * (Phase 1, docs/plans/write-the-phased-plan-wobbly-pancake.md). Runs via Node's native test
 * runner (node --test), same as content-parser.test.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDocument, flattenToPlainText, stripMarkdownSyntax } = require('../content/parseDocument');
const { parseContentFile } = require('../content/parseContentFile');

const CONTENT_ROOT = path.join(__dirname, '..', '..', 'content');
const GOLDEN_DIR = path.join(__dirname, 'golden');

function loadGolden(name) {
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, `${name}.json`), 'utf8'));
}

// --- Golden-file test per block type -------------------------------------------------------

test('parseDocument: paragraph + subheading — golden fixture', () => {
  const body = ['# A subheading', '', 'Plain prose about the SSB process.'].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:paragraph.md' });
  assert.deepEqual(model, loadGolden('paragraph'));
});

test('parseDocument: list — golden fixture', () => {
  const body = ['## Section', '', '- First item', '- Second item', '- Third item'].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:list.md' });
  assert.deepEqual(model, loadGolden('list'));
});

test('parseDocument: specTable — golden fixture', () => {
  const body = [
    '## Format and Structure',
    '',
    '**Duration**: 20-30 minutes',
    '**Group Size**: 8-10 candidates',
    '**Assessment**: Communication, leadership',
  ].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:specTable.md' });
  assert.deepEqual(model, loadGolden('specTable'));
});

test('parseDocument: callout — golden fixture', () => {
  const body = ['## Wrap-up', '', '**Remember**: Be that candidate.'].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:callout.md' });
  assert.deepEqual(model, loadGolden('callout'));
});

test('parseDocument: comparison — golden fixture (Myth/Reality pairs merge into one block)', () => {
  const body = [
    '## Common Myths',
    '',
    '**Myth 1**: "There are fixed correct answers"',
    '**Reality**: It\'s about patterns, not individual responses',
    '',
    '**Myth 2**: "You can memorize good responses"',
    '**Reality**: Memorized responses create obvious inconsistency',
  ].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:comparison.md' });
  assert.deepEqual(model, loadGolden('comparison'));
});

test('parseDocument: timeline — golden fixture', () => {
  const body = [
    '## Day 2 Schedule',
    '',
    '**9:00 AM**: Reporting and briefing',
    '',
    '**9:30 AM**: TAT (approximately 1 hour)',
  ].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:timeline.md' });
  assert.deepEqual(model, loadGolden('timeline'));
});

test('parseDocument: table — golden fixture', () => {
  const body = [
    '## General Preparation Timeline',
    '',
    '| Timeframe before SSB | Action |',
    '|---|---|',
    '| 3-6 months | Eye exam, dental check-up |',
    '| 1-3 months | Build/maintain fitness routine |',
  ].join('\n');
  const model = parseDocument(body, { sourcePath: 'fixture:table.md' });
  assert.deepEqual(model, loadGolden('table'));
});

test('parseDocument: unrecognised label runs fall back to specTable/paragraph, never a new type (D1)', () => {
  const body = ['## Section', '', 'A totally ordinary paragraph with **inline bold** in it.'].join('\n');
  const { sections } = parseDocument(body, { sourcePath: 'fixture:fallback.md' });
  const { TAXONOMY } = require('../content/blockClassifier');
  for (const section of sections) {
    for (const block of section.blocks) {
      assert.ok(TAXONOMY.includes(block.type), `unexpected block type "${block.type}" outside the frozen taxonomy`);
    }
  }
});

// --- Slug pinning ----------------------------------------------------------------------------

test('parseDocument: slug is pinned from existingSlugs and NOT re-derived from changed heading text', () => {
  const body = '## A Brand New Heading\n\nSome body text.';
  const { sections } = parseDocument(body, {
    sourcePath: 'fixture:slug.md',
    existingSlugs: { 'fixture:slug.md#0': 'the-original-slug' },
  });
  assert.equal(sections[0].slug, 'the-original-slug');
});

test('parseDocument: throws when a previously-pinned slug\'s section disappears without a migration entry', () => {
  const body = 'No headings at all here.';
  assert.throws(
    () => parseDocument(body, {
      sourcePath: 'fixture:vanished.md',
      existingSlugs: { 'fixture:vanished.md#0': 'gone-now' },
    }),
    /pinned slug "gone-now"/
  );
});

// --- Exact-text conservation gate, over the real corpus --------------------------------------

function collectRealFiles() {
  const files = [];
  for (const dir of ['topics', 'study-materials']) {
    const d = path.join(CONTENT_ROOT, dir);
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.md')) files.push(path.join(d, f));
    }
  }
  files.push(path.join(CONTENT_ROOT, 'faq.md'));
  return files;
}

test('parseDocument: exact-text conservation — every real content/**/*.md file round-trips losslessly', () => {
  const files = collectRealFiles();
  assert.ok(files.length >= 60, `expected at least 60 content files, found ${files.length}`);
  const failures = [];
  for (const sourcePath of files) {
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const { body } = parseContentFile(raw, sourcePath);
    const model = parseDocument(body, { sourcePath });
    const flat = flattenToPlainText(model);
    const expected = stripMarkdownSyntax(body);
    if (flat !== expected) failures.push(sourcePath);
  }
  assert.deepEqual(failures, [], `these files lost/reordered/duplicated content: ${failures.join(', ')}`);
});
