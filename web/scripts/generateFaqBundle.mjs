// Phase 7 (docs/plans/i-just-watched-a-nested-russell.md): materializes content/faq.md into
// a static JSON module, same "read the git bundle, never a runtime fetch" approach as
// generateContentBundle.mjs (Blocker 1/2). Kept as its own small bundle rather than folded
// into contentBundle.json since FAQ's shape (a list of question/answer pairs) is genuinely
// different from a topic's (introduction + materials) -- forcing one shape onto both would
// make both harder to read.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadFaq } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'faqBundle.json');

const faq = loadFaq();
const bundle = {
  title: faq.meta.title,
  seoTitle: faq.meta.seoTitle,
  seoDescription: faq.meta.seoDescription,
  questions: faq.questions,
};

writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${bundle.questions.length} FAQ question(s) to ${OUT_PATH}`);
