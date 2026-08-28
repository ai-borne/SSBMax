// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md): asserts the JSON-LD builders
// emit schema.org's required fields per type, and that every node is JSON-serializable
// (a builder that throws or emits `undefined` would fail silently in prerendering, not at
// build time, since JSON.stringify drops undefined keys rather than erroring).
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
  it('produces the Course node then the BreadcrumbList node, both JSON-parseable round-trip', () => {
    const topicId = routes[0].topicId;
    const topic = contentBundle[topicId];
    const seo = seoTable[topicId];
    const path = routes[0].path;

    const nodes = buildContentPageJsonLd({ topic, seo, path });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]['@type']).toEqual(expect.arrayContaining(['Course']));
    expect(nodes[1]['@type']).toBe('BreadcrumbList');

    for (const node of nodes) {
      const json = serializeJsonLd(node);
      expect(JSON.parse(json)).toEqual(node);
    }
  });
});

describe('buildFaqPageJsonLd (Phase 7)', () => {
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
