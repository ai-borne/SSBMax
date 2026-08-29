import { marked } from 'marked';

/**
 * Shifts every heading level in a rendered HTML string by `offset` (min 6). Markdown authored
 * as a flat document (its own `#`/`##`/`###`) needs this once it's rendered *inside* a page or
 * component that already has its own heading (e.g. a modal's `<h2>` title) -- otherwise the
 * content's headings collide with or outrank the surrounding UI's own outline. Mirrors
 * web/scripts/generateContentBundle.mjs's build-time shiftHeadings (same problem, runtime
 * side -- StudyMaterial content is fetched live from Firestore, not the git content/ bundle,
 * so it can't be pre-rendered at build time).
 */
function shiftHeadings(html: string, offset: number): string {
  return html.replace(/<(\/?)h([1-6])>/g, (_match, closing: string, level: string) => {
    const newLevel = Math.min(6, Number(level) + offset);
    return `<${closing}h${newLevel}>`;
  });
}

/**
 * Runtime markdown -> HTML for content fetched live from Firestore (StudyMaterial.contentMarkdown
 * via ContentRepository) -- render with dangerouslySetInnerHTML, never as text. Firestore
 * `study_materials`/`topic_content` only ever accept writes from trusted backend/admin paths
 * (`allow write: if false` in firestore.rules -- see docs/plans/ai_search_readiness_phase0_findings.md
 * §5), the same trust level as the git-authored content/ bundle StudyTopicPage.tsx renders the
 * same way, so this carries no new XSS surface.
 */
export function renderMarkdown(markdown: string, headingOffset = 0): string {
  const html = marked.parse(markdown, { async: false });
  return headingOffset > 0 ? shiftHeadings(html, headingOffset) : html;
}
