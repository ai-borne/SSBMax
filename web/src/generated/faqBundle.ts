// Typed accessor over generated/faqBundle.json (produced by
// `npm run generate:faq` / `scripts/generateFaqBundle.mjs` from content/faq.md -- see
// docs/plans/i-just-watched-a-nested-russell.md Phase 7). Not itself regenerated; kept
// hand-written since the shape is stable and small (mirrors generated/contentBundle.ts).
import faqBundleJson from './faqBundle.json' with { type: 'json' };

export interface FaqQuestion {
  question: string;
  answer: string;
}

export interface FaqBundle {
  title: string;
  seoTitle: string;
  seoDescription: string;
  questions: FaqQuestion[];
}

export const faqBundle = faqBundleJson as FaqBundle;
