// Asserts the JSON-LD builders emit schema.org's required fields per type, and that every
// node is JSON-serializable (a builder that throws or emits `undefined` would fail silently
// in prerendering, not at build time, since JSON.stringify drops undefined keys rather than
// erroring). Organization/WebSite/Course/LearningResource/BreadcrumbList/FAQPage(faq.md)
// shipped in docs/plans/i-just-watched-a-nested-russell.md; the ItemList/HowTo/Myth-Reality
// FAQPage coverage below is Phase 6 of docs/plans/write-the-phased-plan-wobbly-pancake.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildBreadcrumbListJsonLd,
  buildCourseJsonLd,
  buildContentPageJsonLd,
  buildFaqPageJsonLd,
  buildFaqPageJsonLdFromPairs,
  buildHowToJsonLd,
  buildSectionItemListJsonLd,
  extractMythRealityFaqPairs,
  serializeJsonLd,
  SITE_BASE_URL,
} from '../../../scripts/jsonLd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const contentBundle = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'contentBundle.json'), 'utf8'));
const routes = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentRoutes.json'), 'utf8'));
const seoTable = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentSeo.json'), 'utf8'));
const faq = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'faqBundle.json'), 'utf8'));

describe('buildOrganizationJsonLd', () => {
  it('has the required @type, name, and url', () => {
    const node = buildOrganizationJsonLd();
    expect(node['@context']).toBe('https://schema.org');
    expect(node['@type']).toBe('Organization');
    expect(node.name).toBe('SSBMax');
    expect(node.url).toBe(SITE_BASE_URL);
  });
});

describe('buildWebSiteJsonLd', () => {
  it('has the required @type, name, and url', () => {
    const node = buildWebSiteJsonLd();
    expect(node['@type']).toBe('WebSite');
    expect(node.name).toBe('SSBMax');
    expect(node.url).toBe(SITE_BASE_URL);
  });
});

describe('buildBreadcrumbListJsonLd', () => {
  it('lists Home > Study > topic, each with position and an absolute item URL', () => {
    const node = buildBreadcrumbListJsonLd({ title: 'OIR Test', path: '/study/ssb-oir-test-preparation' });
    const items = node.itemListElement as Array<{ position: number; item: string; name: string }>;
    expect(node['@type']).toBe('BreadcrumbList');
    expect(items).toHaveLength(3);
    items.forEach((item, i) => {
      expect(item.position).toBe(i + 1);
      expect(item.item).toMatch(/^https:\/\//);
    });
    expect(items[2].name).toBe('OIR Test');
    expect(items[2].item).toBe(`${SITE_BASE_URL}/study/ssb-oir-test-preparation`);
  });
});

describe('buildCourseJsonLd, for every real content route', () => {
  for (const { topicId, path } of routes) {
    const topic = contentBundle[topicId];
    const seo = seoTable[topicId];

    it(`${topicId}: carries name, description, url, and an Organization provider`, () => {
      const node = buildCourseJsonLd({ topic, seo, path });
      expect(node['@type']).toEqual(expect.arrayContaining(['Course', 'LearningResource']));
      expect(node.name).toBe(topic.title);
      expect(node.description).toBe(seo.description);
      expect(node.url).toBe(`${SITE_BASE_URL}${path}`);
      expect((node.provider as Record<string, unknown>)['@type']).toBe('Organization');
      expect(node.learningResourceType).toBeTruthy();
    });
  }
});

describe('buildContentPageJsonLd + serializeJsonLd', () => {
  it('always leads with the Course node then the BreadcrumbList node, every node JSON-parseable round-trip', () => {
    for (const { topicId, path } of routes) {
      const topic = contentBundle[topicId];
      const seo = seoTable[topicId];

      const nodes = buildContentPageJsonLd({ topic, seo, path });
      expect(nodes[0]['@type']).toEqual(expect.arrayContaining(['Course']));
      expect(nodes[1]['@type']).toBe('BreadcrumbList');

      for (const node of nodes) {
        const json = serializeJsonLd(node);
        expect(JSON.parse(json)).toEqual(node);
      }
    }
  });

  it('appends an ItemList outlining every headed section, in document order, once a topic has any', () => {
    const topic = contentBundle.PSYCHOLOGY;
    const seo = seoTable.PSYCHOLOGY;
    const path = routes.find((r: { topicId: string }) => r.topicId === 'PSYCHOLOGY').path;

    const nodes = buildContentPageJsonLd({ topic, seo, path });
    const itemList = nodes.find((n: Record<string, unknown>) => n['@type'] === 'ItemList');
    expect(itemList).toBeDefined();
    const items = itemList!.itemListElement as Array<{ position: number; name: string; url: string }>;
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item, i) => {
      expect(item.position).toBe(i + 1);
      expect(item.name).toBeTruthy();
      expect(item.url).toMatch(new RegExp(`^${SITE_BASE_URL}${path}#`));
    });
  });

  it('appends one HowTo per timeline-bearing section, using the timeline block\'s own step labels/text', () => {
    const topic = contentBundle.PSYCHOLOGY;
    const seo = seoTable.PSYCHOLOGY;
    const path = routes.find((r: { topicId: string }) => r.topicId === 'PSYCHOLOGY').path;

    const nodes = buildContentPageJsonLd({ topic, seo, path });
    const howTos = nodes.filter((n: Record<string, unknown>) => n['@type'] === 'HowTo');
    // psy_1.md carries two distinct timelines (the day schedule, and the preparation timeline).
    expect(howTos.length).toBeGreaterThanOrEqual(2);
    for (const howTo of howTos) {
      expect(howTo.name).toBeTruthy();
      const steps = howTo.step as Array<{ '@type': string; name: string; text: string }>;
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step['@type']).toBe('HowToStep');
        expect(step.name).toBeTruthy();
        expect(step.text).toBeTruthy();
      }
    }
  });

  it('appends a Myth/Reality FAQPage only for a topic that actually has Myth/Reality comparison pairs', () => {
    const psychTopic = contentBundle.PSYCHOLOGY;
    const psychPath = routes.find((r: { topicId: string }) => r.topicId === 'PSYCHOLOGY').path;
    const nodes = buildContentPageJsonLd({ topic: psychTopic, seo: seoTable.PSYCHOLOGY, path: psychPath });
    const faqPages = nodes.filter((n: Record<string, unknown>) => n['@type'] === 'FAQPage');
    expect(faqPages).toHaveLength(1);
    const mainEntity = faqPages[0].mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    // psy_1.md's "Common Myths Debunked" section alone has 5 Myth/Reality pairs.
    expect(mainEntity.length).toBeGreaterThanOrEqual(5);

    const oirTopic = contentBundle.OIR;
    const oirPath = routes.find((r: { topicId: string }) => r.topicId === 'OIR').path;
    const oirNodes = buildContentPageJsonLd({ topic: oirTopic, seo: seoTable.OIR, path: oirPath });
    expect(oirNodes.some((n: Record<string, unknown>) => n['@type'] === 'FAQPage')).toBe(false);
  });
});

describe('buildHowToJsonLd', () => {
  it('maps each {label, text} step to a HowToStep {name, text}', () => {
    const node = buildHowToJsonLd({
      name: 'Preparation Timeline',
      steps: [{ label: '4 Weeks Before', text: 'Understand test formats' }],
    });
    expect(node['@type']).toBe('HowTo');
    expect(node.name).toBe('Preparation Timeline');
    const steps = node.step as Array<{ '@type': string; name: string; text: string }>;
    expect(steps).toEqual([{ '@type': 'HowToStep', name: '4 Weeks Before', text: 'Understand test formats' }]);
  });
});

describe('buildSectionItemListJsonLd', () => {
  it('numbers ListItems from 1 and anchors each url at its section slug', () => {
    const node = buildSectionItemListJsonLd({
      sections: [
        { id: 's1', slug: 'intro', heading: 'Intro', level: 2, blocks: [] },
        { id: 's2', slug: 'details', heading: 'Details', level: 2, blocks: [] },
      ],
      path: '/study/example',
    });
    expect(node['@type']).toBe('ItemList');
    expect(node.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Intro', url: `${SITE_BASE_URL}/study/example#intro` },
      { '@type': 'ListItem', position: 2, name: 'Details', url: `${SITE_BASE_URL}/study/example#details` },
    ]);
  });
});

describe('extractMythRealityFaqPairs', () => {
  it('pairs each Myth N with the Reality immediately after it, ignoring Wrong/Right and Problem/Solution comparisons', () => {
    const pairs = extractMythRealityFaqPairs(contentBundle.PSYCHOLOGY);
    expect(pairs.length).toBeGreaterThanOrEqual(5);
    for (const pair of pairs) {
      expect(pair.question).toBeTruthy();
      expect(pair.answer).toBeTruthy();
    }
  });

  it('returns an empty array for a topic with no Myth/Reality comparison pairs', () => {
    expect(extractMythRealityFaqPairs(contentBundle.OIR)).toEqual([]);
  });
});

describe('buildFaqPageJsonLdFromPairs', () => {
  it('is the shared builder buildFaqPageJsonLd and the Myth/Reality extraction both route through', () => {
    const node = buildFaqPageJsonLdFromPairs([{ question: 'Q1', answer: 'A1' }]);
    expect(node['@type']).toBe('FAQPage');
    expect(node.mainEntity).toEqual([
      { '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' } },
    ]);
  });
});

describe('buildFaqPageJsonLd', () => {
  it('emits one Question/Answer mainEntity per FAQ entry, matching the real content/faq.md questions', () => {
    const node = buildFaqPageJsonLd({ faq });
    expect(node['@context']).toBe('https://schema.org');
    expect(node['@type']).toBe('FAQPage');
    const mainEntity = node.mainEntity as Array<{ '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }>;
    expect(mainEntity).toHaveLength(faq.questions.length);
    mainEntity.forEach((entry, i) => {
      expect(entry['@type']).toBe('Question');
      expect(entry.name).toBe(faq.questions[i].question);
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
      expect(entry.acceptedAnswer.text).toBe(faq.questions[i].answer);
    });
  });

  it('is JSON-serializable round-trip', () => {
    const node = buildFaqPageJsonLd({ faq });
    expect(JSON.parse(serializeJsonLd(node))).toEqual(node);
  });
});
