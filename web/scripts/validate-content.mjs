// Standalone content-pipeline gate: `npm run content:validate`. Not yet wired
// into `npm run build` — no page reads content/ until Phase 2/5 of
// docs/plans/i-just-watched-a-nested-russell.md add the routes and
// prerenderer that actually consume it, so failing the required `web-ci`
// build over content that nothing renders yet would be a premature gate.
// Phase 5 wires this same assertPublishable check into the real build so it
// fails loudly on empty/missing content instead of shipping hollow pages.
import { loadTopics, loadStudyMaterials, loadFaq, assertPublishable } from './loadContent.mjs';

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
console.log('All content files valid.');
