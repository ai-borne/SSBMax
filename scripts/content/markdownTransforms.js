/**
 * The canonical implementations of two markdown transforms that were previously maintained
 * twice (`web/scripts/generateContentBundle.mjs` and `web/src/utils/renderMarkdown.ts`) — Phase 1
 * of docs/plans/write-the-phased-plan-wobbly-pancake.md (Readable Study Content) retires both
 * copies in favour of this one. Pure string -> string transforms, no I/O, usable from Node
 * (CJS) and from parseDocument.js.
 */

/**
 * Shifts every heading level in a rendered HTML string by `offset` (min 6). Content markdown
 * is authored as a flat document (its own `#`/`##`/`###`) but rendered nested inside a page's
 * or component's own heading — shifting keeps one real heading outline per page instead of a
 * duplicate `<h1>`/`<h3>`.
 */
function shiftHeadingsHtml(html, offset) {
  return html.replace(/<(\/?)h([1-6])>/g, (_match, closing, level) => {
    const newLevel = Math.min(6, Number(level) + offset);
    return `<${closing}h${newLevel}>`;
  });
}

const LABEL_LINE_RE = /^\*\*[^*]+\*\*:/;

/**
 * Converts a run of 2+ consecutive `**Label**: value` lines (no blank line between them) into
 * a real markdown bullet list, so each spec renders on its own line instead of collapsing into
 * one run-on paragraph (CommonMark treats bare `\n` between them as a soft break, not a line
 * break). A single standalone label line is left as plain text.
 */
function listifyLabelRuns(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (LABEL_LINE_RE.test(lines[i])) {
      const runStart = i;
      while (i < lines.length && LABEL_LINE_RE.test(lines[i])) i += 1;
      const run = lines.slice(runStart, i);
      if (run.length >= 2) {
        if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
        for (const line of run) out.push(`- ${line}`);
        if (i < lines.length && lines[i].trim() !== '') out.push('');
      } else {
        out.push(run[0]);
      }
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return out.join('\n');
}

module.exports = { shiftHeadingsHtml, listifyLabelRuns, LABEL_LINE_RE };
