// Pure functions behind scripts/prerenderContentRoutes.mjs, split out so tests can import
// them without the write-to-dist/ side effect (mirrors loadContent.mjs vs.
// generateContentBundle.mjs, and seoFiles.mjs vs. generateSeoFiles.mjs).
//
// Phase 5 (docs/plans/i-just-watched-a-nested-russell.md), Blocker 1 + Blocker 2: these
// pages must be genuinely static, non-hydrated HTML -- not react-dom/server output seeded
// with window.__INITIAL_DATA__ for a client to hydrate over (that reintroduces the inline-
// script CSP problem for no benefit, since the content is read-only prose with no
// ViewModel). Building the markup directly from the same JSON the app renders from
// (contentBundle.json / contentRoutes.json / contentSeo.json) keeps a single data source
// without requiring a TS loader or an SSR bundle step in a plain Node script.
import { readdirSync } from 'node:fs';
import { buildContentPageJsonLd, serializeJsonLd } from './jsonLd.mjs';

export const SITE_BASE_URL = 'https://ssbmax.in';

/** Escapes text for safe inclusion in HTML body/attribute contexts. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Every built `.css` file under dist/assets, as root-relative hrefs. Tailwind emits one
 * bundle today, but this stays robust to a future code-split without needing an update --
 * scanning the real build output can't drift from what vite actually names the file
 * (content-hashed), unlike hardcoding a path.
 */
export function findCssAssets(distDir) {
  const assetsDir = `${distDir}/assets`;
  let entries;
  try {
    entries = readdirSync(assetsDir);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith('.css')).map((name) => `/assets/${name}`);
}

/**
 * Exact serialized JSON-LD strings embedded in one content page's <head>, in embed order.
 * The one place this is computed -- scripts/cspHeaders.mjs hashes these same strings to
 * build the per-route CSP allowance, so page and hash can never drift apart (Regression 1).
 */
export function buildContentPageJsonLdScripts({ topic, seo, path, siteBaseUrl = SITE_BASE_URL }) {
  return buildContentPageJsonLd({ topic, seo, path, siteBaseUrl }).map(serializeJsonLd);
}

function buildMaterialHtml(material) {
  return `
        <div>
          <h3>${escapeHtml(material.title)}</h3>
          <p>${escapeHtml(material.estimatedReadTimeMinutes)} min read</p>
          <div>${escapeHtml(material.contentMarkdown)}</div>
        </div>`;
}

/**
 * Full static HTML document for one content route. Mirrors StudyTopicPage.tsx's structure
 * (title, introduction, materials) so a direct visitor sees the same content the hydrated
 * SPA route would show for in-app navigation -- but ships zero JS, so there is no hydration
 * mismatch to guard against (Blocker 2).
 */
export function buildContentPageHtml({ topic, seo, path, cssHrefs = [], siteBaseUrl = SITE_BASE_URL }) {
  const url = `${siteBaseUrl}${path}`;
  const cssLinks = cssHrefs.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`).join('\n    ');
  const jsonLdScripts = buildContentPageJsonLdScripts({ topic, seo, path, siteBaseUrl });
  const materialsHtml = topic.materials.length > 0
    ? `
      <section>
        <h2>Study Materials</h2>
        <div>${topic.materials.map(buildMaterialHtml).join('\n')}
        </div>
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    ${cssLinks}
    ${jsonLdScripts.map((json) => `<script type="application/ld+json">${json}</script>`).join('\n    ')}
  </head>
  <body class="bg-slate-900 text-slate-50 min-h-screen">
    <article class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <a href="/">Back to home</a>
      <h1>${escapeHtml(topic.title)}</h1>
      <div>${escapeHtml(topic.introduction)}</div>${materialsHtml}
    </article>
  </body>
</html>
`;
}
