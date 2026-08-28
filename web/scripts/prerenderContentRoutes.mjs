// Phase 5 (docs/plans/i-just-watched-a-nested-russell.md): after `vite build` produces the
// hydrated SPA in dist/, write a genuinely static dist/<route>/index.html for every public
// content route. Runs as part of `npm run build`, before write-version.mjs, so
// dist/version.json (Regression 2) is untouched by this step.
//
// This closes HIGH 6: Cloudflare Pages has no web/public/_redirects SPA catch-all (Phase 0
// confirmed none exists), so before this script ran, a cold/direct visit to a content route
// in production had no matching static file and no rewrite to fall back on. Writing a real
// file at the exact path is what makes these routes servable at all on a cold load --
// Cloudflare Pages resolves a request to a matching static asset before any redirect logic,
// so this file wins over nothing rather than needing to win over a catch-all.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildContentPageHtml, buildContentPageJsonLdScripts, findCssAssets, SITE_BASE_URL } from './prerenderHtml.mjs';
import { buildContentRouteHeaderBlock } from './cspHeaders.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');

const contentBundle = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'contentBundle.json'), 'utf8'));
const routes = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentRoutes.json'), 'utf8'));
const seoTable = JSON.parse(readFileSync(join(ROOT, 'src', 'routes', 'contentSeo.json'), 'utf8'));

const cssHrefs = findCssAssets(DIST_DIR);
if (cssHrefs.length === 0) {
  throw new Error('prerenderContentRoutes: no dist/assets/*.css found -- did `vite build` run first?');
}

// Phase 6, Regression 1: dist/_headers already exists here -- `vite build` copies
// public/_headers into dist/ verbatim before this script runs. Every route's CSP hash
// allowance is appended to it, never replacing the base policy on disk.
const HEADERS_PATH = join(DIST_DIR, '_headers');
const baseHeadersFileContent = readFileSync(HEADERS_PATH, 'utf8');

let written = 0;
for (const { topicId, path } of routes) {
  const topic = contentBundle[topicId];
  const seo = seoTable[topicId];
  if (!topic) throw new Error(`prerenderContentRoutes: no contentBundle entry for topicId "${topicId}"`);
  if (!seo) throw new Error(`prerenderContentRoutes: no contentSeo entry for topicId "${topicId}"`);

  const html = buildContentPageHtml({ topic, seo, path, cssHrefs, siteBaseUrl: SITE_BASE_URL });
  const outDir = join(DIST_DIR, ...path.split('/').filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);

  const jsonLdScripts = buildContentPageJsonLdScripts({ topic, seo, path, siteBaseUrl: SITE_BASE_URL });
  const headerBlock = buildContentRouteHeaderBlock({ path, jsonLdScripts, baseHeadersFileContent });
  appendFileSync(HEADERS_PATH, headerBlock);

  written += 1;
}

console.log(`Prerendered ${written} static content page(s) into dist/, each with its own CSP script-src hash allowance.`);
