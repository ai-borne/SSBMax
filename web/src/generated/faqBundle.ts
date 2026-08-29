// Typed accessor over generated/faqBundle.json (produced by
// `npm run generate:faq` / `scripts/generateFaqBundle.mjs` from content/faq.md -- see
// docs/plans/i-just-watched-a-nested-russell.md Phase 7). Not itself regenerated; kept
// hand-written since the shape is stable and small (mirrors generated/contentBundle.ts).
import faqBundleJson from './faqBundle.json' with { type: 'json' };
import type { DocBlock } from '../components/content/blocks/types';

export interface FaqQuestion {
  question: string;
  /** Raw plain text, kept only for jsonLd.mjs's FAQPage schema -- render `answerBlocks`, not
   * this, for anything visible (Phase 4, docs/plans/write-the-phased-plan-wobbly-pancake.md). */
  answer: string;
  /** Parsed at build time (scripts/generateFaqBundle.mjs) -- render via the block registry,
   * never as raw text (D4). */
  answerBlocks: DocBlock[];
}

export interface FaqBundle {
  title: string;
  seoTitle: string;
  seoDescription: string;
  questions: FaqQuestion[];
}

export const faqBundle = faqBundleJson as FaqBundle;
