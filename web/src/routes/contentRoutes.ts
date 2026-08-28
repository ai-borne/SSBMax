// SSOT for public content-page URLs (Phase 2, docs/plans/i-just-watched-a-nested-russell.md,
// HIGH 5). Decided ONCE and treated as permanent: a crawler-indexed URL is expensive to
// change (301s + re-crawl), so this list is the single place a slug is chosen, and it must
// not be edited casually once shipped. Phase 3's sitemap generator and Phase 5's prerenderer
// both read this same list -- adding a topic here is what makes it public and crawlable.
//
// Slugs match real search-query phrasing ("ssb oir test preparation") rather than internal
// naming ("day-1") -- see HIGH 5's fix.
import type { ContentBundleTopicId } from '../generated/contentBundle';

export interface ContentRoute {
  topicId: ContentBundleTopicId;
  path: string;
}

export const CONTENT_ROUTES: ContentRoute[] = [
  { topicId: 'SSB_OVERVIEW', path: '/study/ssb-selection-process-guide' },
  { topicId: 'OIR', path: '/study/ssb-oir-test-preparation' },
  { topicId: 'PPDT', path: '/study/ssb-ppdt-picture-perception-discussion-test' },
  { topicId: 'PIQ_FORM', path: '/study/ssb-piq-form-guide' },
  { topicId: 'PSYCHOLOGY', path: '/study/ssb-psychology-tests-tat-wat-srt-sd' },
  { topicId: 'GTO', path: '/study/ssb-gto-tasks-guide' },
  { topicId: 'INTERVIEW', path: '/study/ssb-personal-interview-guide' },
  { topicId: 'CONFERENCE', path: '/study/ssb-conference-day-guide' },
  { topicId: 'MEDICALS', path: '/study/ssb-medical-examination-guide' },
];
