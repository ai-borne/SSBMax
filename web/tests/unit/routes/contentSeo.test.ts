// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md), HIGH 5's "match real query
// phrasing" applied to meta copy: every route in CONTENT_ROUTES must have real SEO copy, not
// a generic placeholder -- a missing entry would ship a public page with no <title>/description
// distinct from the app shell's default, which is exactly the "textbook empty shell to
// crawlers" problem this whole plan exists to fix.
import { describe, it, expect } from 'vitest';
import { CONTENT_ROUTES } from '../../../src/routes/contentRoutes';
import { CONTENT_SEO } from '../../../src/routes/contentSeo';

describe('CONTENT_SEO', () => {
  it('has an entry for every route in CONTENT_ROUTES, no more, no fewer', () => {
    const routeTopicIds = new Set(CONTENT_ROUTES.map((r) => r.topicId));
    expect(new Set(Object.keys(CONTENT_SEO))).toEqual(routeTopicIds);
  });

  for (const { topicId } of CONTENT_ROUTES) {
    it(`${topicId}: title and description are real copy, not placeholders`, () => {
      const seo = CONTENT_SEO[topicId];
      expect(seo.title.length).toBeGreaterThan(10);
      expect(seo.title.length).toBeLessThanOrEqual(70);
      expect(seo.description.length).toBeGreaterThan(50);
      expect(seo.description.length).toBeLessThanOrEqual(200);
      expect(seo.description.toLowerCase()).toContain('ssb');
    });
  }
});
