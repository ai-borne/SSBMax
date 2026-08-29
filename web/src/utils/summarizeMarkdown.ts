/**
 * Derives a plain-text summary snippet from raw markdown -- used only as the last-resort
 * fallback when a Firestore `study_materials` doc has no `summary` field of its own (none of
 * the 51 materials do; `content/study-materials/*.md` frontmatter never defines one). The
 * previous fallback (`content.slice(0, 150)`) showed literal markdown syntax -- `#`, `**` --
 * verbatim in StudyReaderModal's "Executive Summary" blockquote once a real Firestore document
 * reached it (see docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 5 parity gate: "no
 * literal markdown syntax visible anywhere").
 *
 * Deliberately lightweight regex cleanup, not a markdown parser (D4 forbids runtime markdown
 * *rendering*, i.e. producing HTML from git-authored prose at runtime; this only strips syntax
 * markers to get a plain-text snippet, the same class of operation the buggy fallback it
 * replaces was already doing, just correctly).
 */
export function summarizeMarkdown(markdown: string, maxLength = 150): string {
  const plain = markdown
    .split('\n')
    .filter((line) => !/^#{1,6}\s/.test(line.trim())) // drop heading lines entirely, not just their `#`s
    .map((line) => line.replace(/^\s*[-*]\s+/, '')) // list markers, per-line before joining
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}
