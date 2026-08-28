// SSOT for public content-page URLs (Phase 2, docs/plans/i-just-watched-a-nested-russell.md,
// HIGH 5). Decided ONCE and treated as permanent: a crawler-indexed URL is expensive to
// change (301s + re-crawl), so this list is the single place a slug is chosen, and it must
// not be edited casually once shipped. Phase 3's sitemap generator and Phase 5's prerenderer
// both read this same list -- adding a topic here is what makes it public and crawlable.
//
// Slugs match real search-query phrasing ("ssb oir test preparation") rather than internal
// naming ("day-1") -- see HIGH 5's fix.
//
// Phase 3: the actual (topicId, path) pairs now live in contentRoutes.json, not here --
// scripts/generateSitemap.mjs (plain Node, no TS loader available) needs the exact same
// list to build sitemap.xml/llms.txt without drifting from what react-router serves, so JSON
// is the one file both the app and the build scripts read. This module stays the typed
// entry point everything under src/ imports.
import type { ContentBundleTopicId } from '../generated/contentBundle';
import routesJson from './contentRoutes.json';

export interface ContentRoute {
  topicId: ContentBundleTopicId;
  path: string;
}

export const CONTENT_ROUTES: ContentRoute[] = routesJson as ContentRoute[];

/**
 * Production origin, used to build absolute canonical/OG URLs and the sitemap.
 * scripts/generateSitemap.mjs hardcodes the same value (plain Node script, no TS import) --
 * update both if the domain ever changes.
 */
export const SITE_BASE_URL = 'https://ssbmax.in';
