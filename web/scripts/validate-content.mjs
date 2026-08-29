// Content-pipeline gate: `npm run content:validate`, now wired into `npm run build`
// (Phase 1, docs/plans/write-the-phased-plan-wobbly-pancake.md) — it also runs
// scripts/content/parseDocument.js over every file and the slug-lock `--check`, so a build
// fails loudly on empty/missing content, a body the parser can't account for exactly, or a
// stale content/slugs.lock.json, instead of any of those surfacing later as a silent runtime gap.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTopics, loadStudyMaterials, loadFaq, assertPublishable } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_CONTENT = join(__dirname, '..', '..', 'scripts', 'content');

function validate(entries) {
  const errors = [];
  for (const { sourcePath, body } of entries) {
    try {
      assertPublishable(body, sourcePath);
    } catch (e) {
      errors.push(e.message);
    }
  }
  return errors;
}

const topics = loadTopics();
const materials = loadStudyMaterials();
const errors = [...validate(topics), ...validate(materials)];

// loadFaq() itself throws on a missing/answerless question -- parseFaqQuestions already
// validates FAQ's shape, so there's nothing extra to run through assertPublishable here
// beyond confirming the file loads at all.
let faqCount = 0;
try {
  faqCount = loadFaq().questions.length;
} catch (e) {
  errors.push(e.message);
}

console.log(`Checked ${topics.length} topic file(s), ${materials.length} study-material file(s), and ${faqCount} FAQ question(s).`);
if (errors.length) {
  console.error(`\n${errors.length} invalid:`);
  errors.forEach((msg) => console.error(`  - ${msg}`));
  process.exit(1);
}

// The slug lockfile check belongs to the same "does content/ still parse cleanly" gate: a
// stale lockfile means a section was added/removed/reordered without an explicit migration
// entry, which is exactly what buildSlugLock.js's --check flag is designed to catch.
try {
  execFileSync('node', [join(SCRIPTS_CONTENT, 'buildSlugLock.js'), '--check'], { stdio: 'inherit' });
} catch (e) {
  console.error('\ncontent/slugs.lock.json check failed (see above).');
  process.exit(1);
}

console.log('All content files valid.');
