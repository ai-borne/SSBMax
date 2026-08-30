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
// Every topic/material body is parsed at build time into a structured DocumentModel
// (scripts/content/parseDocument.js) -- StudyTopicPage.tsx and prerenderHtml.mjs render it via
// DocumentView/the block registry (D4, docs/plans/write-the-phased-plan-wobbly-pancake.md: no
// markdown parsing in the browser or on device). The bundle used to also carry a build-time
// `marked`-rendered `introductionHtml` blob as a per-topic rollout fallback; that flag reached
// 100% of topics and was removed in the Phase 8 sweep, so `introductionHtml` and the `marked`
// dependency it required are gone too -- distinct from the differently-shaped `contentMarkdown`
// field the pre-existing, Firestore-runtime-fed StudyMaterial type (src/types/testContent.ts)
// still uses, which is untouched by this change.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { loadTopics, loadStudyMaterials, assertPublishable } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'contentBundle.json');
const CONTENT_ROOT = join(__dirname, '..', '..', 'content');
const SLUGS_LOCK_PATH = join(CONTENT_ROOT, 'slugs.lock.json');

const require = createRequire(import.meta.url);
const { parseDocument, summaryFromModel } = require('../../scripts/content/parseDocument.js');

const slugsLock = JSON.parse(readFileSync(SLUGS_LOCK_PATH, 'utf-8'));

/**
 * Structured DocumentModel per topic (Phase 2, docs/plans/write-the-phased-plan-wobbly-pancake.md).
 * Existing slugs are read (never written) here -- this build script is not the slug lockfile's
 * writer, buildSlugLock.js is.
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
  for (const { id, meta, body, sourcePath } of materials) {
    const list = materialsByTopic.get(meta.topicType) ?? [];
    // Structured DocumentModel (Phase 4) -- StudyTopicPage.tsx and prerenderHtml.mjs render
    // this via DocumentView/the block registry, never `dangerouslySetInnerHTML`.
    const sections = buildIntroductionSections(sourcePath, body);
    list.push({
      id,
      title: meta.title,
      category: meta.category,
      summary: summaryFromModel(sections),
      sections,
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
      introductionSections: buildIntroductionSections(sourcePath, body),
      materials: materialsByTopic.get(meta.topicType) ?? [],
    };
  }
  return topicsById;
}

const bundle = buildBundle();
writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${Object.keys(bundle).length} topic(s) to ${OUT_PATH}`);
