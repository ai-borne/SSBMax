import { marked } from 'marked';
// shiftHeadingsHtml/listifyLabelRuns used to be maintained twice (here and in
// web/scripts/generateContentBundle.mjs) -- scripts/content/markdownTransforms.js (Phase 1,
// docs/plans/write-the-phased-plan-wobbly-pancake.md) is now the one canonical copy both sides
// import. Same problem, runtime side: StudyMaterial content is fetched live from Firestore, not
// the git content/ bundle, so it can't be pre-rendered at build time like generateContentBundle.mjs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shiftHeadingsHtml: shiftHeadings, listifyLabelRuns } = require('../../../scripts/content/markdownTransforms.js');

/**
 * Runtime markdown -> HTML for content fetched live from Firestore (StudyMaterial.contentMarkdown
 * via ContentRepository) -- render with dangerouslySetInnerHTML, never as text. Firestore
 * `study_materials`/`topic_content` only ever accept writes from trusted backend/admin paths
 * (`allow write: if false` in firestore.rules -- see docs/plans/ai_search_readiness_phase0_findings.md
 * §5), the same trust level as the git-authored content/ bundle StudyTopicPage.tsx renders the
 * same way, so this carries no new XSS surface.
 */
export function renderMarkdown(markdown: string, headingOffset = 0): string {
  const html = marked.parse(listifyLabelRuns(markdown), { async: false });
  return headingOffset > 0 ? shiftHeadings(html, headingOffset) : html;
}
