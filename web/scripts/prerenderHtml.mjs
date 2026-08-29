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
import { buildContentPageJsonLd, buildFaqPageJsonLd, serializeJsonLd, SITE_BASE_URL } from './jsonLd.mjs';

export { SITE_BASE_URL };

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

/**
 * Cloudflare Web Analytics beacon (Phase 8, ai_search_readiness plan): these prerendered
 * pages are the actual GEO landing pages, so traffic/referrer data must come from here, not
 * only the hydrated app shell -- see index.html's copy of this tag for the CSP rationale
 * (external script src, no inline-script hash needed). Empty token renders a harmless no-op
 * tag rather than omitting it, matching index.html's fallback stance.
 */
function buildCfBeaconScriptTag(cfBeaconToken) {
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${escapeHtml(cfBeaconToken)}"}'></script>`;
}

/**
 * Renders inline `**bold**` markers the same way `inlineBold.tsx` does, for HTML built by
 * hand outside React (Phase 4, docs/plans/write-the-phased-plan-wobbly-pancake.md). Only
 * `**bold**` -- the only inline markup the block parser leaves for a block renderer to handle
 * (content/SCHEMA.md).
 */
function renderInlineBoldHtml(text) {
  // `[^*]+`, not `.+?` -- must match across newlines too (a bold span can wrap multiple
  // lines, see inlineBold.tsx's identical `[^*]+` choice and the oir_6.md regression this
  // caught: `.` alone excludes `\n`, silently leaving multi-line `**...**` spans unrendered).
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const NEGATIVE_COMPARISON_LABEL_RE = /^(wrong|myth|problem|negative)/i;

/**
 * Server-side twin of `blockRegistry.ts`'s components, for the static (non-hydrated) prerender
 * path -- same block shapes (content/SCHEMA.md), same Tailwind design intent, hand-built as a
 * string like the rest of this file rather than via react-dom/server (Blocker 2: this script
 * has no SSR bundle step, see the file-level doc comment). Unrecognised types fall back to
 * plain text (D1), same as the client registry.
 */
function buildBlockHtml(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p class="text-sm sm:text-base text-slate-300 leading-relaxed">${renderInlineBoldHtml(block.text)}</p>`;
    case 'list':
      return `<ul class="list-disc pl-5 space-y-1 text-sm sm:text-base text-slate-300 leading-relaxed">${block.items
        .map((item) => `<li>${renderInlineBoldHtml(item)}</li>`)
        .join('')}</ul>`;
    case 'subheading': {
      const tag = `h${Math.min(6, Math.max(2, block.level))}`;
      return `<${tag} class="mt-4 font-semibold text-white">${escapeHtml(block.text)}</${tag}>`;
    }
    case 'specTable':
      return `<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm sm:text-base rounded-lg border border-slate-800 p-4">${block.entries
        .map((e) => `<dt class="font-semibold text-white">${escapeHtml(e.label)}</dt><dd class="text-slate-300">${renderInlineBoldHtml(e.text)}</dd>`)
        .join('')}</dl>`;
    case 'callout': {
      const isWarning = block.marker.toLowerCase() === 'warning';
      const tint = isWarning ? 'border-amber-800 bg-amber-950/40 text-amber-300' : 'border-sky-900 bg-sky-950/40 text-sky-300';
      return `<aside class="rounded-lg border p-4 ${tint}"><p class="text-xs font-bold uppercase tracking-wide">${escapeHtml(block.marker)}</p><p class="mt-1 text-sm sm:text-base text-slate-300">${renderInlineBoldHtml(block.text)}</p></aside>`;
    }
    case 'comparison':
      return `<div class="space-y-2">${block.pairs
        .map((pair) => {
          const negative = NEGATIVE_COMPARISON_LABEL_RE.test(pair.label);
          const tint = negative ? 'border-rose-900 bg-rose-950/30' : 'border-emerald-900 bg-emerald-950/30';
          return `<div class="rounded-lg border p-3 ${tint}"><span class="text-sm font-bold text-white">${negative ? '✗' : '✓'} ${escapeHtml(pair.label)}:</span> <span class="text-sm sm:text-base text-slate-300">${renderInlineBoldHtml(pair.text)}</span></div>`;
        })
        .join('')}</div>`;
    case 'timeline':
      return `<ol class="relative border-l border-slate-700 pl-4 space-y-4">${block.steps
        .map((step) => `<li><p class="text-sm font-bold text-white">${escapeHtml(step.label)}</p><p class="text-sm sm:text-base text-slate-300">${renderInlineBoldHtml(step.text)}</p></li>`)
        .join('')}</ol>`;
    case 'table': {
      const [header, ...body] = block.rows;
      const headerHtml = header
        ? `<thead><tr>${header.map((cell) => `<th class="p-2 text-left font-semibold text-white border-b border-slate-800">${renderInlineBoldHtml(cell)}</th>`).join('')}</tr></thead>`
        : '';
      const bodyHtml = body
        .map((row) => `<tr>${row.map((cell) => `<td class="p-2 text-slate-300 border-b border-slate-800">${renderInlineBoldHtml(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<div class="overflow-x-auto"><table class="min-w-full text-sm sm:text-base border border-slate-800">${headerHtml}<tbody>${bodyHtml}</tbody></table></div>`;
    }
    default:
      return `<p class="text-sm sm:text-base text-slate-300 leading-relaxed">${escapeHtml(JSON.stringify(block))}</p>`;
  }
}

/**
 * Renders a DocumentModel's sections -- see `DocumentView.tsx`'s hydrated twin, which this
 * must stay in lockstep with (including the per-section panel styling -- the plan's
 * "Readability devices" table: "Section chunking -- one panel per ##") or the prerendered and
 * hydrated views visibly diverge. This file renders on a fixed dark background (no `dark:`
 * variants anywhere else in it), so the panel uses the same slate-900/slate-800 tone directly.
 */
function buildDocumentHtml(model) {
  return model.sections
    .map((section) => {
      const heading = section.heading ? `<h2 class="text-lg font-bold text-white">${escapeHtml(section.heading)}</h2>` : '';
      const blocksHtml = section.blocks.map(buildBlockHtml).join('\n          ');
      return `
        <section id="${escapeHtml(section.slug)}" class="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
          ${heading}
          <div class="mt-3 space-y-4">
            ${blocksHtml}
          </div>
        </section>`;
    })
    .join('\n');
}

/**
 * material.sections is a structured DocumentModel (Phase 4, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), produced by scripts/generateContentBundle.mjs --
 * rendered here via buildDocumentHtml, never as raw text (that was the FAQ-answer bug this
 * phase also fixes, see buildFaqQuestionHtml).
 */
function buildMaterialHtml(material) {
  return `
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">${escapeHtml(material.title)}</h3>
          <p class="text-xs font-mono text-slate-500 dark:text-slate-400">${escapeHtml(material.estimatedReadTimeMinutes)} min read</p>
          <div class="mt-2">${buildDocumentHtml(material.sections)}</div>
        </div>`;
}

/**
 * Full static HTML document for one content route. Mirrors StudyTopicPage.tsx's structure
 * (title, introduction, materials) so a direct visitor sees the same content the hydrated
 * SPA route would show for in-app navigation -- but ships zero JS, so there is no hydration
 * mismatch to guard against (Blocker 2).
 */
export function buildContentPageHtml({ topic, seo, path, cssHrefs = [], siteBaseUrl = SITE_BASE_URL, cfBeaconToken = '' }) {
  const url = `${siteBaseUrl}${path}`;
  const cssLinks = cssHrefs.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`).join('\n    ');
  const jsonLdScripts = buildContentPageJsonLdScripts({ topic, seo, path, siteBaseUrl });
  const materialsHtml = topic.materials.length > 0
    ? `
      <section class="mt-10">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Study Materials</h2>
        <div class="mt-4 space-y-8">${topic.materials.map(buildMaterialHtml).join('\n')}
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
      <a href="/" class="text-xs font-semibold text-sky-400 hover:underline">Back to home</a>
      <h1 class="mt-4 text-2xl sm:text-3xl font-bold text-white">${escapeHtml(topic.title)}</h1>
      <div class="mt-4 prose dark:prose-invert max-w-none text-sm sm:text-base text-slate-300 leading-relaxed">${topic.introductionHtml}</div>${materialsHtml}
    </article>
    ${buildCfBeaconScriptTag(cfBeaconToken)}
  </body>
</html>
`;
}

/**
 * Exact serialized JSON-LD strings embedded in the static /faq page's <head> -- mirrors
 * buildContentPageJsonLdScripts so scripts/cspHeaders.mjs can hash it the same way.
 */
export function buildFaqPageJsonLdScripts({ faq, siteBaseUrl = SITE_BASE_URL }) {
  return [serializeJsonLd(buildFaqPageJsonLd({ faq, siteBaseUrl }))];
}

/**
 * `answerBlocks` is parsed at build time (scripts/generateFaqBundle.mjs, via
 * scripts/content/parseDocument.js) -- fixes the FAQ answers-as-escaped-plain-text defect
 * (docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 4 defect #3): answers previously
 * went through `escapeHtml(answer)` alone, so any `**bold**` in an answer showed as literal
 * asterisks to visitors and crawlers.
 */
function buildFaqQuestionHtml({ question, answerBlocks }) {
  const blocksHtml = answerBlocks.map(buildBlockHtml).join('\n        ');
  return `
      <div>
        <h2 class="text-base font-semibold text-white">${escapeHtml(question)}</h2>
        <div class="mt-2 space-y-2">
        ${blocksHtml}
        </div>
      </div>`;
}

/** Full static HTML document for the /faq route. Mirrors FaqPage.tsx's structure, non-hydrated (Blocker 2). */
export function buildFaqPageHtml({ faq, cssHrefs = [], siteBaseUrl = SITE_BASE_URL, cfBeaconToken = '' }) {
  const url = `${siteBaseUrl}/faq`;
  const cssLinks = cssHrefs.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`).join('\n    ');
  const jsonLdScripts = buildFaqPageJsonLdScripts({ faq, siteBaseUrl });

  return `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(faq.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(faq.seoDescription)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(faq.seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(faq.seoDescription)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(faq.seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(faq.seoDescription)}" />
    ${cssLinks}
    ${jsonLdScripts.map((json) => `<script type="application/ld+json">${json}</script>`).join('\n    ')}
  </head>
  <body class="bg-slate-900 text-slate-50 min-h-screen">
    <article class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <a href="/" class="text-xs font-semibold text-sky-400 hover:underline">Back to home</a>
      <h1 class="mt-4 text-2xl sm:text-3xl font-bold text-white">${escapeHtml(faq.title)}</h1>
      <div class="mt-8 space-y-8">${faq.questions.map(buildFaqQuestionHtml).join('\n')}
      </div>
    </article>
    ${buildCfBeaconScriptTag(cfBeaconToken)}
  </body>
</html>
`;
}
