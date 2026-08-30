// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md): per-route <title>/description
// copy, keyed by the same ContentBundleTopicId as CONTENT_ROUTES. Phrasing is drawn from the
// real query list AI-visibility diagnostic queries in
// docs/plans/ai_search_readiness_phase0_findings.md#8, not internal naming -- HIGH 5's
// "match real query phrasing" fix applies to meta copy exactly as much as to the slug.
// useDocumentMeta (src/hooks/useDocumentMeta.ts) reads this at render time for in-app
// navigation; Phase 5's scripts/prerenderHtml.mjs reads the sibling contentSeo.json (same
// data, JSON so the plain-Node prerender script can read it without a TS loader -- same
// split as contentRoutes.json/contentRoutes.ts) to bake meta tags into static HTML.
import type { ContentBundleTopicId } from '../generated/contentBundle';
import contentSeoJson from './contentSeo.json' with { type: 'json' };

export interface ContentSeo {
  title: string;
  description: string;
}

export const CONTENT_SEO: Record<ContentBundleTopicId, ContentSeo> = contentSeoJson as Record<
  ContentBundleTopicId,
  ContentSeo
>;
