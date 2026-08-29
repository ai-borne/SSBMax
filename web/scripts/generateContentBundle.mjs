// Phase 2 (docs/plans/i-just-watched-a-nested-russell.md): materializes content/ into a
// static JSON module the new content routes import synchronously. Deliberately NOT a
// runtime fetch -- Blocker 2 rules out seeding async data into hydrated routes, and this
// bundle is the first slice of Blocker 1's "read the git bundle, never the runtime
// repository" fix (full static-HTML prerendering follows in Phase 5).
//
// Reuses assertPublishable so a build fails loudly on placeholder/empty content instead of
// shipping a hollow public page -- the gate scripts/validate-content.mjs left unwired
// because nothing rendered content/ yet. Now something does.
//
// Markdown is converted to HTML here, at build time (via `marked`, a devDependency -- it
// never ships in the client bundle), not left as raw markdown for a component to interpolate
// as text. That was a real bug: StudyTopicPage.tsx and prerenderHtml.mjs both used to render
// `introduction`/`contentMarkdown` as plain text, so every public content page showed literal
// `**bold**`/`##`/`- ` syntax to visitors and crawlers. Fields are named *Html to make the
// contract explicit at every call site (dangerouslySetInnerHTML / raw HTML interpolation),
// and distinct from the differently-shaped `contentMarkdown` field the pre-existing,
// Firestore-runtime-fed StudyMaterial type (src/types/testContent.ts) still uses -- that
// path is untouched by this change; see the Phase 9 deep-check notes for why.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { marked } from 'marked';
import { loadTopics, loadStudyMaterials, assertPublishable } from './loadContent.mjs';
import { shiftHeadingsHtml as shiftHeadings, listifyLabelRuns } from '../../scripts/content/markdownTransforms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'contentBundle.json');
const CONTENT_ROOT = join(__dirname, '..', '..', 'content');
const SLUGS_LOCK_PATH = join(CONTENT_ROOT, 'slugs.lock.json');

// shiftHeadings/listifyLabelRuns used to be maintained twice (here and in
// web/src/utils/renderMarkdown.ts) -- scripts/content/markdownTransforms.mjs (Phase 1,
// docs/plans/write-the-phased-plan-wobbly-pancake.md) is now the one canonical copy both sides
// import (a plain ESM import here, not `require()` -- that file is real ESM so it can also be
// imported directly from the browser bundle; see its own doc comment). `shiftHeadingsHtml` here
// operates on rendered HTML (nesting the markdown's own heading outline under the page's real
// `<h1>`/`<h3>`); `listifyLabelRuns` converts a run of 2+ consecutive `**Label**: value` lines
// into a real bullet list before marked.parse() runs, so each spec renders on its own line
// instead of collapsing into one CommonMark soft-break run-on paragraph.
const require = createRequire(import.meta.url);
const { parseDocument } = require('../../scripts/content/parseDocument.js');

const slugsLock = JSON.parse(readFileSync(SLUGS_LOCK_PATH, 'utf-8'));

/**
 * Structured DocumentModel per topic (Phase 2, docs/plans/write-the-phased-plan-wobbly-pancake.md
 * -- the pilot-topic slice). Additive alongside `introductionHtml`: nothing reads this yet except
 * StudyTopicPage.tsx's `useStructuredRendering` flag for the SSB_OVERVIEW pilot; every other
 * topic keeps rendering from `introductionHtml` unchanged. Existing slugs are read (never
 * written) here -- this build script is not the slug lockfile's writer, buildSlugLock.js is.
 */
function buildIntroductionSections(sourcePath, body) {
  const relPath = relative(CONTENT_ROOT, sourcePath);
  return parseDocument(body, { sourcePath: relPath, existingSlugs: slugsLock });
}

function buildBundle() {
  const topics = loadTopics();
  const materials = loadStudyMaterials();

  for (const { sourcePath, body } of [...topics, ...materials]) {
    assertPublishable(body, sourcePath);
  }

  const materialsByTopic = new Map();
  for (const { id, meta, body } of materials) {
    const list = materialsByTopic.get(meta.topicType) ?? [];
    list.push({
      id,
      title: meta.title,
      category: meta.category,
      summary: body.split('\n').find((line) => line.trim().length > 0)?.slice(0, 200) ?? '',
      // Nested under the page's <h1> title + <h2> "Study Materials" + this material's own <h3>.
      contentHtml: shiftHeadings(marked.parse(listifyLabelRuns(body), { async: false }), 3),
      estimatedReadTimeMinutes: Number.parseInt(meta.readTime, 10) || 5,
      tags: meta.tags ?? [],
      displayOrder: meta.displayOrder ?? 0,
    });
    materialsByTopic.set(meta.topicType, list);
  }
  for (const list of materialsByTopic.values()) {
    list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const topicsById = {};
  for (const { id, meta, body, sourcePath } of topics) {
    topicsById[id] = {
      id,
      title: meta.title,
      // Nested under the page's own <h1>{title}</h1>.
      introductionHtml: shiftHeadings(marked.parse(listifyLabelRuns(body), { async: false }), 1),
      introductionSections: buildIntroductionSections(sourcePath, body),
      materials: materialsByTopic.get(meta.topicType) ?? [],
    };
  }
  return topicsById;
}

const bundle = buildBundle();
writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${Object.keys(bundle).length} topic(s) to ${OUT_PATH}`);
