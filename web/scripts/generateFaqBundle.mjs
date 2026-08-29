// Phase 7 (docs/plans/i-just-watched-a-nested-russell.md): materializes content/faq.md into
// a static JSON module, same "read the git bundle, never a runtime fetch" approach as
// generateContentBundle.mjs (Blocker 1/2). Kept as its own small bundle rather than folded
// into contentBundle.json since FAQ's shape (a list of question/answer pairs) is genuinely
// different from a topic's (introduction + materials) -- forcing one shape onto both would
// make both harder to read.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { loadFaq } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'faqBundle.json');

const require = createRequire(import.meta.url);
const { parseDocument } = require('../../scripts/content/parseDocument.js');

const faq = loadFaq();
const bundle = {
  title: faq.meta.title,
  seoTitle: faq.meta.seoTitle,
  seoDescription: faq.meta.seoDescription,
  // `answer` stays raw plain text -- jsonLd.mjs's FAQPage schema wants plain text, not HTML/
  // blocks. `answerBlocks` is new in Phase 4 (docs/plans/write-the-phased-plan-wobbly-pancake.md):
  // FaqPage.tsx and prerenderHtml.mjs render this instead, fixing the defect where an answer's
  // `**bold**` markup showed as literal asterisks (it was never markdown-parsed at all). No
  // slug pinning needed here -- FAQ answers have no anchors -- so `existingSlugs` is left empty.
  questions: faq.questions.map((q, index) => ({
    ...q,
    answerBlocks: parseDocument(q.answer, { sourcePath: `faq.md#${index}` }).sections.flatMap((s) => s.blocks),
  })),
};

writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${bundle.questions.length} FAQ question(s) to ${OUT_PATH}`);
