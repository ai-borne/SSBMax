/**
 * Tests for scripts/content/parseContentFile.js — the content/ markdown +
 * frontmatter parser that both publishContent.js and the web build rely on.
 * Runs via Node native test runner (node --test scripts/test).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseContentFile, assertPublishable, PLACEHOLDER_BODY } = require('../content/parseContentFile');

test('parseContentFile: golden fixture — frontmatter and body parse to the exact expected structure', () => {
  const raw = [
    '---',
    'id: "OIR"',
    'topicType: "OIR"',
    'title: "Officer Intelligence Rating"',
    'isPremium: false',
    'version: 2',
    'tags: ["a","b"]',
    '---',
    '',
    'Line one.',
    '',
    'Line two.',
    '',
  ].join('\n');

  const { meta, body } = parseContentFile(raw, 'fixture.md');

  assert.deepEqual(meta, {
    id: 'OIR',
    topicType: 'OIR',
    title: 'Officer Intelligence Rating',
    isPremium: false,
    version: 2,
    tags: ['a', 'b'],
  });
  assert.equal(body, 'Line one.\n\nLine two.');
});

test('parseContentFile: throws when the --- frontmatter block is missing', () => {
  assert.throws(() => parseContentFile('just a body, no frontmatter', 'bad.md'), /missing --- frontmatter/);
});

test('parseContentFile: throws when a frontmatter value is not valid JSON', () => {
  const raw = '---\ntitle: not json\n---\nbody\n';
  assert.throws(() => parseContentFile(raw, 'bad.md'), /not valid JSON/);
});

test('assertPublishable: rejects an empty body', () => {
  assert.throws(() => assertPublishable({ body: '' }, 'empty.md'), /empty body/);
});

test('assertPublishable: rejects the known "being prepared" placeholder', () => {
  assert.throws(() => assertPublishable({ body: PLACEHOLDER_BODY }, 'stub.md'), /placeholder/);
});

test('assertPublishable: rejects bodies under the minimum word count', () => {
  assert.throws(() => assertPublishable({ body: 'Too short.' }, 'short.md'), /fewer than/);
});

test('assertPublishable: accepts real prose', () => {
  const body = new Array(25).fill('word').join(' ');
  assert.doesNotThrow(() => assertPublishable({ body }, 'ok.md'));
});
