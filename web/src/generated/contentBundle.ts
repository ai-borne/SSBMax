// Typed accessor over generated/contentBundle.json (produced by
// `npm run generate:content` / `scripts/generateContentBundle.mjs` from the git-authored
// content/ directory -- see docs/plans/i-just-watched-a-nested-russell.md Phase 1/2). Not
// itself regenerated; kept hand-written since the shape is stable and small.
import contentBundleJson from './contentBundle.json' with { type: 'json' };

export interface ContentTopicMaterial {
  id: string;
  title: string;
  category: string;
  summary: string;
  contentMarkdown: string;
  estimatedReadTimeMinutes: number;
  tags: string[];
}

export interface ContentTopic {
  id: string;
  title: string;
  introduction: string;
  materials: ContentTopicMaterial[];
}

export type ContentBundleTopicId = keyof typeof contentBundleJson;

export const contentBundle = contentBundleJson as Record<ContentBundleTopicId, ContentTopic>;
