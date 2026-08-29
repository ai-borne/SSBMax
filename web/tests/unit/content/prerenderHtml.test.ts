// Phase 5 (docs/plans/i-just-watched-a-nested-russell.md): exercises the pure builders
// behind scripts/prerenderContentRoutes.mjs directly (see that file's comment on why the
// write-to-dist/ script is split out). Covers the phase's stated exit gate -- "each route's
// generated HTML contains expected content via non-JS fetch" -- against the real content
// bundle/routes/SEO tables the build actually uses, so a topic with thin or missing content
// fails here rather than shipping a hollow public page.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildContentPageHtml,
  buildContentPageJsonLdScripts,
  buildFaqPageHtml,
  buildFaqPageJsonLdScripts,
  escapeHtml,
  findCssAssets,
  SITE_BASE_URL,
} from '../../../scripts/prerenderHtml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

const contentBundle = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'contentBundle.json'), 'utf8'));
const routes = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentRoutes.json'), 'utf8'));
const seoTable = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentSeo.json'), 'utf8'));
const faq = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'faqBundle.json'), 'utf8'));

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')&"y"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;'
    );
  });
});

describe('findCssAssets', () => {
  it('returns an empty list when the directory does not exist, instead of throwing', () => {
    expect(findCssAssets('/does/not/exist')).toEqual([]);
  });
});

describe('buildContentPageHtml, for every real content route', () => {
  for (const { topicId, path } of routes) {
    const topic = contentBundle[topicId];
    const seo = seoTable[topicId];

    describe(topicId, () => {
      const html = buildContentPageHtml({ topic, seo, path, cssHrefs: ['/assets/index-abc123.css'], cfBeaconToken: 'test-token' });

      // Phase 8: the Cloudflare Web Analytics beacon is a deliberate, allowlisted exception --
      // an external script src (no inline body, so no hydration payload and no CSP hash
      // needed), not a relaxation of Blocker 2's "no hydration/module scripts" rule.
      it('is a genuinely static document -- no hydration/module scripts (Blocker 2), only inert JSON-LD and the CF beacon', () => {
        expect(html).not.toMatch(/<script(?!\s+type="application\/ld\+json")(?!\s+defer\s+src="https:\/\/static\.cloudflareinsights\.com)/);
        expect(html).not.toContain('__INITIAL_DATA__');
      });

      it('embeds the Cloudflare Web Analytics beacon with the given token', () => {
        expect(html).toContain('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "test-token"}\'></script>');
      });

      it('embeds this route\'s exact JSON-LD blocks, each valid JSON (Phase 6)', () => {
        const jsonLdScripts = buildContentPageJsonLdScripts({ topic, seo, path });
        expect(jsonLdScripts.length).toBeGreaterThan(0);
        for (const json of jsonLdScripts) {
          expect(html).toContain(`<script type="application/ld+json">${json}</script>`);
          expect(() => JSON.parse(json)).not.toThrow();
        }
      });

      it('contains the real topic title and introduction, rendered as chunked structured HTML not raw markdown (Phase 8)', () => {
        expect(html).toContain(escapeHtml(topic.title));
        for (const section of topic.introductionSections.sections) {
          if (section.heading) expect(html).toContain(escapeHtml(section.heading));
        }
        expect(html).not.toContain('**');
      });

      it('contains every material title and section heading for this topic, rendered as HTML not raw markdown', () => {
        for (const material of topic.materials) {
          expect(html).toContain(escapeHtml(material.title));
          for (const section of material.sections.sections) {
            if (section.heading) expect(html).toContain(escapeHtml(section.heading));
          }
        }
      });

      it('carries the exact SEO title/description as <title>, meta, OG, and Twitter tags', () => {
        expect(html).toContain(`<title>${escapeHtml(seo.title)}</title>`);
        expect(html).toContain(`<meta name="description" content="${escapeHtml(seo.description)}" />`);
        expect(html).toContain(`<meta property="og:title" content="${escapeHtml(seo.title)}" />`);
        expect(html).toContain(`<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`);
      });

      it('sets a canonical link matching this route\'s permanent URL', () => {
        expect(html).toContain(`<link rel="canonical" href="${SITE_BASE_URL}${path}" />`);
      });

      it('links the given CSS asset so a human visitor still sees styled content', () => {
        expect(html).toContain('<link rel="stylesheet" href="/assets/index-abc123.css" />');
      });

      it('renders the introduction as one chunked panel per section, matching StudyTopicPage.tsx/DocumentView.tsx (Phase 8)', () => {
        expect(html).toMatch(/<article class="[^"]*max-w-3xl/);
        expect(html).toContain('mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:p-5');
      });

      it('defaults to the dark theme with no JS required to apply it', () => {
        expect(html).toContain('<html lang="en" class="dark">');
      });

      it('is well-formed enough to be a real HTML document', () => {
        expect(html).toMatch(/^<!DOCTYPE html>/);
        expect(html).toMatch(/<h1[ >]/);
      });
    });
  }
});

describe('buildFaqPageHtml (Phase 7)', () => {
  const html = buildFaqPageHtml({ faq, cssHrefs: ['/assets/index-abc123.css'], cfBeaconToken: 'test-token' });

  it('is a genuinely static document -- no hydration/module scripts, only inert JSON-LD and the CF beacon', () => {
    expect(html).not.toMatch(/<script(?!\s+type="application\/ld\+json")(?!\s+defer\s+src="https:\/\/static\.cloudflareinsights\.com)/);
    expect(html).not.toContain('__INITIAL_DATA__');
  });

  it('embeds the Cloudflare Web Analytics beacon with the given token', () => {
    expect(html).toContain('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "test-token"}\'></script>');
  });

  it('embeds the FAQPage JSON-LD block, valid JSON', () => {
    const jsonLdScripts = buildFaqPageJsonLdScripts({ faq });
    expect(jsonLdScripts).toHaveLength(1);
    expect(html).toContain(`<script type="application/ld+json">${jsonLdScripts[0]}</script>`);
    expect(() => JSON.parse(jsonLdScripts[0])).not.toThrow();
  });

  it('contains every question and answer from content/faq.md, rendered as HTML not raw markdown', () => {
    for (const { question, answer, answerBlocks } of faq.questions) {
      expect(html).toContain(escapeHtml(question));
      // Answers are rendered from parsed answerBlocks (Phase 4 fix for the escaped-plain-text
      // defect), so the raw markdown-syntax answer string itself must NOT appear verbatim --
      // that would mean `**bold**` etc. leaked through as literal text again.
      if (/\*\*|^- |^\d+\. /m.test(answer)) {
        expect(html).not.toContain(escapeHtml(answer));
      }
      for (const block of answerBlocks) {
        if (typeof (block as { text?: unknown }).text === 'string') {
          expect(html).toContain(escapeHtml((block as { text: string }).text.replace(/\*\*/g, '')));
        }
      }
    }
  });

  it('carries the FAQ SEO title/description as <title>, meta, OG, and Twitter tags', () => {
    expect(html).toContain(`<title>${escapeHtml(faq.seoTitle)}</title>`);
    expect(html).toContain(`<meta name="description" content="${escapeHtml(faq.seoDescription)}" />`);
    expect(html).toContain(`<meta property="og:title" content="${escapeHtml(faq.seoTitle)}" />`);
  });

  it('sets a canonical link matching /faq', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE_BASE_URL}/faq" />`);
  });

  it('is well-formed enough to be a real HTML document', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toMatch(/<h1[ >]/);
  });

  it('applies visible spacing between question/answer blocks, matching FaqPage.tsx', () => {
    expect(html).toContain('space-y-8');
  });
});

describe('parseDocument spec-line classification -- the actual generated bundle', () => {
  // A user-reported readability bug: consecutive `**Label**: value` spec lines (Duration/
  // Format/Rules/Assessment...) with no blank line between them rendered as one collapsed
  // run-on paragraph instead of separate lines. Found in 37 of 60 content/ files by grep audit
  // after the report. Fixed by parseDocument classifying such runs as a `specTable` block
  // instead of a `paragraph` block (scripts/content/parseDocument.js, Phase 1). Both topic
  // intros and materials go through the same parser (`introductionHtml`, the legacy
  // `marked`-rendered fallback this test used to check, was removed in the Phase 8 sweep), so
  // this regresses if any `paragraph` block's raw text still contains a 2+-label run.
  interface DocParagraphBlock { type: string; text?: string }
  interface DocSection { blocks: DocParagraphBlock[] }
  interface DocumentModelForTest { sections: DocSection[] }
  interface ContentBundleTopicForTest {
    id: string;
    introductionSections: DocumentModelForTest;
    materials: { id: string; sections: DocumentModelForTest }[];
  }

  function hasRunOnLabelParagraph(model: DocumentModelForTest): boolean {
    // Matches only a `**Label**:` at the START of a line (the original bug's exact shape --
    // consecutive spec lines with no blank line between them). A bold label used mid-sentence
    // or inside a list item (e.g. "- **Encouragement**: ...") is legitimate prose, not this bug.
    return model.sections.some((section) =>
      section.blocks.some(
        (block) =>
          block.type === 'paragraph' &&
          (block.text?.match(/^\*\*[^*\n]+\*\*:/gm) ?? []).length >= 2
      )
    );
  }

  it('never leaves 2+ consecutive bold-label spec fields collapsed into one paragraph block', () => {
    const topics = Object.values(contentBundle) as ContentBundleTopicForTest[];
    for (const topic of topics) {
      expect(hasRunOnLabelParagraph(topic.introductionSections), `topic "${topic.id}" introduction`).toBe(false);
      for (const material of topic.materials) {
        expect(hasRunOnLabelParagraph(material.sections), `material "${material.id}"`).toBe(false);
      }
    }
  });
});

describe('Cloudflare Web Analytics beacon defaults (Phase 8)', () => {
  it('renders a harmless empty-token beacon when cfBeaconToken is omitted, matching index.html\'s unset-env fallback', () => {
    const [{ topicId, path }] = routes;
    const html = buildContentPageHtml({ topic: contentBundle[topicId], seo: seoTable[topicId], path, cssHrefs: [] });
    expect(html).toContain('data-cf-beacon=\'{"token": ""}\'');
  });

  it('HTML-escapes the token so it cannot break out of the data-cf-beacon attribute', () => {
    const [{ topicId, path }] = routes;
    const html = buildContentPageHtml({
      topic: contentBundle[topicId],
      seo: seoTable[topicId],
      path,
      cssHrefs: [],
      cfBeaconToken: `"><script>alert(1)</script>`
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
