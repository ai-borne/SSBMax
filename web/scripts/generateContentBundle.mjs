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
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { marked } from 'marked';
import { loadTopics, loadStudyMaterials, assertPublishable } from './loadContent.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'generated', 'contentBundle.json');

/**
 * Content markdown is authored as a flat document (its own `#`/`##`/`###`), but it's rendered
 * nested inside the page's real heading structure -- StudyTopicPage.tsx wraps the topic
 * introduction under an `<h1>` page title, and each material's body under an `<h3>` material
 * title. Rendering the markdown's headings verbatim would emit a second `<h1>` (or duplicate
 * `<h3>`) per page -- multiple h1s is exactly the kind of malformed-outline signal AI/SEO
 * crawlers penalize, the opposite of this bundle's purpose. Shifting by a fixed offset keeps
 * one real heading outline per page instead.
 */
function shiftHeadings(html, offset) {
  return html.replace(/<(\/?)h([1-6])>/g, (_match, closing, level) => {
    const newLevel = Math.min(6, Number(level) + offset);
    return `<${closing}h${newLevel}>`;
  });
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
      contentHtml: shiftHeadings(marked.parse(body, { async: false }), 3),
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
      // Nested under the page's own <h1>{title}</h1>.
      introductionHtml: shiftHeadings(marked.parse(body, { async: false }), 1),
      materials: materialsByTopic.get(meta.topicType) ?? [],
    };
  }
  return topicsById;
}

const bundle = buildBundle();
writeFileSync(OUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${Object.keys(bundle).length} topic(s) to ${OUT_PATH}`);
