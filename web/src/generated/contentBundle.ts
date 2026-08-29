// Typed accessor over generated/contentBundle.json (produced by
// `npm run generate:content` / `scripts/generateContentBundle.mjs` from the git-authored
// content/ directory -- see docs/plans/i-just-watched-a-nested-russell.md Phase 1/2). Not
// itself regenerated; kept hand-written since the shape is stable and small.
import contentBundleJson from './contentBundle.json' with { type: 'json' };
import type { DocumentModel } from '../components/content/blocks/types';

export interface ContentTopicMaterial {
  id: string;
  title: string;
  category: string;
  summary: string;
  /** Structured DocumentModel (Phase 4, docs/plans/write-the-phased-plan-wobbly-pancake.md),
   * from `scripts/content/parseDocument.js` at build time -- render via `DocumentView`, never
   * parsed again at runtime (D4). */
  sections: DocumentModel;
  estimatedReadTimeMinutes: number;
  tags: string[];
}

export interface ContentTopic {
  id: string;
  title: string;
  /** Pre-rendered HTML (build-time markdown->HTML via `marked`, scripts/generateContentBundle.mjs) -- render with dangerouslySetInnerHTML, never as text. */
  introductionHtml: string;
  /** Structured DocumentModel (Phase 2, docs/plans/write-the-phased-plan-wobbly-pancake.md),
   * from `scripts/content/parseDocument.js` at build time -- render via `DocumentView`, never
   * parsed again at runtime (D4). Additive alongside `introductionHtml`; only read behind the
   * `useStructuredRendering` pilot flag today. */
  introductionSections: DocumentModel;
  materials: ContentTopicMaterial[];
}

export type ContentBundleTopicId = keyof typeof contentBundleJson;

export const contentBundle = contentBundleJson as Record<ContentBundleTopicId, ContentTopic>;
