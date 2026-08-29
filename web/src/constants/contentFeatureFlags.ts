import type { ContentBundleTopicId } from '../generated/contentBundle';

/**
 * Rollout flag for the Phase 2 structured-content renderer (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md). Mirrors the KMP twin,
 * `ContentFeatureFlags.kt`'s per-topic flag map -- same shape, same rollout intent, so a topic
 * enabled on one platform and not the other is a visible diff in this file rather than a
 * silent behavioral fork. OIR is the Phase 2 pilot: its intro has zero `##` headings
 * pre-Phase-3 (Phase 0 finding), so it parses to structural blocks only (`paragraph`/`list`) --
 * exactly this phase's scope, with no rich-block gap to paper over yet. NOT `SSB_OVERVIEW`:
 * that topic ID maps to a bespoke accordion screen on KMP unrelated to `TopicScreen`, so a
 * KMP-side structured-rendering flag for it would be dead code -- caught by the Phase 2
 * three-surface parity gate (see ContentFeatureFlags.kt's matching comment).
 */
const STRUCTURED_RENDERING_TOPICS: Partial<Record<ContentBundleTopicId, boolean>> = {
  OIR: true,
};

export function isStructuredRenderingEnabled(topicId: ContentBundleTopicId): boolean {
  return STRUCTURED_RENDERING_TOPICS[topicId] === true;
}
