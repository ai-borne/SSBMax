// Phase 2 (docs/plans/i-just-watched-a-nested-russell.md): materializes content/ into a
// static JSON module the new content routes import synchronously. Deliberately NOT a
// runtime fetch -- Blocker 2 rules out seeding async data into hydrated routes, and this
// bundle is the first slice of Blocker 1's "read the git bundle, never the runtime
// repository" fix (full static-HTML prerendering follows in Phase 5).
//
// Reuses assertPublishable so a build fails loudly on placeholder/empty content instead of
// shipping a hollow public page -- the gate scripts/validate-content.mjs left unwired
// because nothing rendered content/ yet. Now something does.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTopics, loadStudyMaterials, assertPublishable } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'contentBundle.json');

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
      contentMarkdown: body,
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
  for (const { id, meta, body } of topics) {
    topicsById[id] = {
      id,
      title: meta.title,
      introduction: body,
      materials: materialsByTopic.get(meta.topicType) ?? [],
    };
  }
  return topicsById;
}

const bundle = buildBundle();
writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${Object.keys(bundle).length} topic(s) to ${OUT_PATH}`);
