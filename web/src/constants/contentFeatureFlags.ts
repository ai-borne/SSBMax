import type { ContentBundleTopicId } from '../generated/contentBundle';

/**
 * Rollout flag for the structured-content renderer (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md). Phase 2 enabled only the OIR pilot, since its
 * intro had zero `##` headings pre-Phase-3 and no rich-block types to exercise. Phase 3
 * normalised all 61 content files to `content/SCHEMA.md`, and Phase 4 added renderers for
 * every remaining block type (`specTable`/`callout`/`comparison`/`timeline`/`table`), so every
 * topic's build-time-generated `introductionSections` is now safe to render -- all nine are
 * enabled here. This is a web-only flag: `generateContentBundle.mjs` regenerates
 * `introductionSections` for every topic unconditionally (no per-topic codegen needed), unlike
 * KMP's twin (`ContentFeatureFlags.kt`'s `structuredRenderingTopics`), which stays OIR-only
 * because every other topic still needs a generated `DocumentModel` from Phase 5's
 * `generateKmpFallback.js` before it can flip -- see that file's doc comment. A topic enabled
 * on one platform and not the other is therefore an expected, currently-scoped diff, not drift.
 */
const STRUCTURED_RENDERING_TOPICS: Partial<Record<ContentBundleTopicId, boolean>> = {
  CONFERENCE: true,
  GTO: true,
  INTERVIEW: true,
  MEDICALS: true,
  OIR: true,
  PIQ_FORM: true,
  PPDT: true,
  PSYCHOLOGY: true,
  SSB_OVERVIEW: true,
};

export function isStructuredRenderingEnabled(topicId: ContentBundleTopicId): boolean {
  return STRUCTURED_RENDERING_TOPICS[topicId] === true;
}
