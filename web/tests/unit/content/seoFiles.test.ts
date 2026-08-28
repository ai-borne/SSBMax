// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md), MEDIUM 11: the sitemap and
// llms.txt must never fall out of sync with the route list a route addition actually
// changes -- contentRoutes.json, not a hand-maintained URL list. These tests exercise the
// pure builders from scripts/seoFiles.mjs directly (see its comment on why the write-to-disk
// script is split out), so adding a route and forgetting to touch this file is impossible:
// the assertions are driven by loadContentRoutes(), the same data generateSeoFiles.mjs writes
// from.
import { describe, it, expect } from 'vitest';
import { loadContentRoutes, buildSitemapXml, buildLlmsTxt, SITE_BASE_URL } from '../../../scripts/seoFiles.mjs';

describe('loadContentRoutes', () => {
  it('reads the same contentRoutes.json the app imports, non-empty', () => {
    const routes = loadContentRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.topicId).toBeTruthy();
      expect(r.path).toMatch(/^\/study\//);
    }
  });
});

describe('buildSitemapXml', () => {
  it('includes the homepage plus every content route as an absolute URL', () => {
    const routes = loadContentRoutes();
    const xml = buildSitemapXml(routes);
    expect(xml).toContain(`<loc>${SITE_BASE_URL}</loc>`);
    for (const r of routes) {
      expect(xml).toContain(`<loc>${SITE_BASE_URL}${r.path}</loc>`);
    }
  });

  it('emits exactly one <url> entry per route plus the homepage -- no drift, no duplicates', () => {
    const routes = loadContentRoutes();
    const xml = buildSitemapXml(routes);
    const matches = xml.match(/<url>/g) ?? [];
    expect(matches.length).toBe(routes.length + 1);
  });

  it('is well-formed enough to parse as XML (balanced tags)', () => {
    const xml = buildSitemapXml(loadContentRoutes());
    expect(xml).toMatch(/^<\?xml/);
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });
});

describe('buildLlmsTxt', () => {
  it('links every content route with its absolute URL', () => {
    const routes = loadContentRoutes();
    const txt = buildLlmsTxt(routes);
    expect(txt).toMatch(/^# SSBMax/);
    for (const r of routes) {
      expect(txt).toContain(`${SITE_BASE_URL}${r.path}`);
    }
  });
});
