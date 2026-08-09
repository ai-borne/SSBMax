// Tripwire for *.rules.test.mjs: fails loudly if a test pinned in REQUIRED_TESTS.txt has been
// deleted or renamed. Runs as npm's `pretest` hook, so both `npm test` locally and CI's
// `npm --prefix firestore-tests test` get it automatically. See REQUIRED_TESTS.txt's header for
// why this exists.
import { readFileSync, readdirSync } from 'node:fs';

const here = new URL('.', import.meta.url);

const manifest = readFileSync(new URL('REQUIRED_TESTS.txt', here), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const testFileContents = new Map();
for (const file of readdirSync(here)) {
  if (file.endsWith('.rules.test.mjs')) {
    testFileContents.set(file, readFileSync(new URL(file, here), 'utf8'));
  }
}

const missing = [];
for (const line of manifest) {
  const sep = line.indexOf('|');
  const file = line.slice(0, sep);
  const title = line.slice(sep + 1);
  const contents = testFileContents.get(file);
  // Title may contain an apostrophe, which the source escapes inside a single-quoted string
  // literal (test('...\'s...', ...)) -- match either quoting style.
  const candidates = [
    `test('${title}'`,
    `test('${title.replace(/'/g, "\\'")}'`,
    `test("${title}"`
  ];
  if (!contents || !candidates.some((needle) => contents.includes(needle))) {
    missing.push(`${file}: "${title}"`);
  }
}

if (missing.length > 0) {
  console.error('\n❌ Required regression test(s) missing or renamed:\n');
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    '\nIf a test is genuinely obsolete, remove its line from REQUIRED_TESTS.txt in the same PR ' +
    'and say why in the commit message -- do not let it disappear silently.\n'
  );
  process.exit(1);
}

console.log(`✅ All ${manifest.length} pinned regression tests present.`);
