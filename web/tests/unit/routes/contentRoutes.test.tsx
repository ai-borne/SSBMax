// Phase 2 (docs/plans/i-just-watched-a-nested-russell.md): every entry in the permanent
// content-route SSOT must actually render real content, and nothing outside CONTENT_ROUTES
// should be reachable via the same mechanism -- a route with no matching bundle topic would
// silently ship an empty public page (Blocker 1's failure mode, one layer up).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CONTENT_ROUTES } from '../../../src/routes/contentRoutes';
import { CONTENT_SEO } from '../../../src/routes/contentSeo';
import { StudyTopicPage } from '../../../src/routes/StudyTopicPage';
import { contentBundle } from '../../../src/generated/contentBundle';

/** All 9 topics render `introductionSections` via `DocumentView` (Phase 8 sweep, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md, removed the per-topic rollout flag) -- pull the
 * comparable "first real text" for this test's markdown-leak assertion. */
function firstRenderedText(topicId: keyof typeof contentBundle): string {
  const topic = contentBundle[topicId];
  const firstTextBlock = topic.introductionSections.sections[0]?.blocks.find(
    (b): b is { type: 'paragraph'; text: string } => b.type === 'paragraph'
  );
  // Inline `**bold**` renders as <strong> (no literal asterisks in the DOM), so strip them
  // here too -- this return value is only used as a rendered-text substring probe below.
  return (firstTextBlock?.text ?? '').replace(/\*\*/g, '');
}

describe('CONTENT_ROUTES', () => {
  it('has exactly one permanent path per bundled topic, with no duplicates', () => {
    const topicIds = CONTENT_ROUTES.map((r) => r.topicId);
    const paths = CONTENT_ROUTES.map((r) => r.path);
    expect(new Set(topicIds).size).toBe(topicIds.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(topicIds)).toEqual(new Set(Object.keys(contentBundle)));
  });

  it('every path is a permanent, intent-matching /study/ slug (HIGH 5)', () => {
    for (const { path } of CONTENT_ROUTES) {
      expect(path).toMatch(/^\/study\/ssb-[a-z0-9-]+$/);
    }
  });

  for (const { topicId, path } of CONTENT_ROUTES) {
    it(`renders real content for ${path}`, () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <StudyTopicPage topicId={topicId} />
        </MemoryRouter>
      );

      const topic = contentBundle[topicId];
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(topic.title);
      // Assert no source markdown syntax leaked through unparsed (the bug this rendering path
      // exists to prevent) -- via introductionHtml (marked) for most topics, or introductionSections
      // (DocumentView) for the Phase 2 pilot -- see firstRenderedText.
      const introText = firstRenderedText(topicId);
      expect(document.body.textContent).toContain(introText.trim().slice(0, 30));
      expect(document.body.textContent).not.toContain('**');
      expect(document.body.textContent).not.toContain('##');
    });

    it(`sets document.title to its real SEO title for ${path} (Phase 3, HIGH 5)`, () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <StudyTopicPage topicId={topicId} />
        </MemoryRouter>
      );
      expect(document.title).toBe(CONTENT_SEO[topicId].title);
    });
  }
});
