/**
 * The one parser (Phase 1, docs/plans/write-the-phased-plan-wobbly-pancake.md): markdown body
 * text -> a structured DocumentModel. Pure and deterministic — no filesystem access, no
 * network, same input always produces the same output. Frontmatter parsing is intentionally
 * NOT duplicated here; callers get `{ meta, body }` from parseContentFile.js first and pass
 * `body` in.
 *
 * DocumentModel shape:
 *   { sections: [ { id, slug, heading, level, blocks: [ ...typed blocks... ] } ] }
 *
 * Sections are chunked on `##` (level-2) headings only — see content/SCHEMA.md. A file with no
 * `##` at all (e.g. today's topic intros, pre Phase-3 normalisation) yields exactly one section
 * with `heading: null, level: 0`. Every other heading level found in the body (`#`, `###`+)
 * is preserved as a `subheading` block rather than starting a new section.
 *
 * Slug pinning: `slug` for a section is taken from `existingSlugs[sectionKey]` when present
 * (see slugKey below) and is NEVER re-derived from heading text once pinned — this is what
 * lets Phase 3 rewrite heading prose without breaking an already-indexed/cited anchor. Callers
 * own reading/writing content/slugs.lock.json; see scripts/content/buildSlugLock.js.
 */

const { classifyChunk, mergeRuns, TAXONOMY } = require('./blockClassifier');

const SECTION_HEADING_RE = /^##\s+(.+)$/;
const ANY_HEADING_RE = /^#{1,6}\s+/;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

/** Stable identity for a section within a file: its 0-based order among `##` headings ("root" for the unheaded intro section). Reordering/removing a section changes this key deliberately — that is the "explicit migration entry" the plan requires. */
function slugKey(sourcePath, sectionIndex, hasHeading) {
  return `${sourcePath}#${hasHeading ? sectionIndex : 'root'}`;
}

/** Splits body text into raw "chunks": blank-line-delimited runs of lines, with any heading line always isolated into its own chunk even when adjacent (no blank line) to surrounding text. */
function splitChunks(body) {
  const lines = body.split('\n');
  const chunks = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      chunks.push(buffer);
      buffer = [];
    }
  };
  for (const line of lines) {
    if (ANY_HEADING_RE.test(line)) {
      flush();
      chunks.push([line]);
    } else if (line.trim() === '') {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

/**
 * @param {string} body - markdown body (frontmatter already stripped by parseContentFile.js)
 * @param {{ sourcePath: string, existingSlugs?: Record<string,string> }} options
 * @returns {{ sections: Array }}
 */
function parseDocument(body, { sourcePath, existingSlugs = {} } = {}) {
  if (!sourcePath) throw new Error('parseDocument: sourcePath is required (used for slug pinning identity)');

  const chunks = splitChunks(body);

  // Group chunks into sections at `##` boundaries.
  const rawSections = [];
  let current = { heading: null, level: 0, chunks: [] };
  for (const chunk of chunks) {
    const headingMatch = chunk.length === 1 && SECTION_HEADING_RE.exec(chunk[0]);
    if (headingMatch) {
      if (current.heading !== null || current.chunks.length) rawSections.push(current);
      current = { heading: headingMatch[1].trim(), level: 2, chunks: [] };
    } else {
      current.chunks.push(chunk);
    }
  }
  if (current.heading !== null || current.chunks.length) rawSections.push(current);

  const usedKeys = new Set();
  const sections = rawSections.map((raw, index) => {
    const hasHeading = raw.heading !== null;
    const key = slugKey(sourcePath, index, hasHeading);
    usedKeys.add(key);
    const slug = existingSlugs[key] || slugify(raw.heading || 'intro');
    const blocks = mergeRuns(raw.chunks.map(classifyChunk));
    return {
      id: key,
      slug,
      heading: raw.heading,
      level: raw.level,
      blocks,
    };
  });

  // Fail loud if a previously-pinned slug's section vanished without an explicit migration
  // entry (i.e. its key is simply absent from existingSlugs's removal — see buildSlugLock.js,
  // which is the only writer of content/slugs.lock.json and is what enforces this at build time).
  for (const key of Object.keys(existingSlugs)) {
    if (key.startsWith(`${sourcePath}#`) && !usedKeys.has(key)) {
      throw new Error(
        `${sourcePath}: pinned slug "${existingSlugs[key]}" (key ${key}) has no matching section anymore. ` +
        `If this section was intentionally removed/renamed, add an explicit migration entry ` +
        `in content/slugs.lock.json rather than letting it silently disappear.`
      );
    }
  }

  return { sections };
}

/** Removes inline markdown emphasis markers only (no line-anchored stripping — see stripMarkdownSyntax for that). */
function stripInline(text) {
  return text.replace(/\*\*/g, '');
}

/**
 * Plain-text summary snippet from a parsed DocumentModel -- the first `paragraph` block's text
 * (skipping subheadings, lists, etc.), inline markers stripped, truncated at a word boundary.
 * Used wherever a `summary` field is needed and the source frontmatter doesn't define one
 * (content/study-materials/*.md never has), replacing an earlier fallback that raw-sliced the
 * first line of markdown and showed literal `#`/`**` syntax whenever that line was a heading.
 */
function summaryFromModel(model, maxLength = 200) {
  for (const section of model.sections) {
    for (const block of section.blocks) {
      if (block.type !== 'paragraph') continue;
      const plain = stripInline(block.text).replace(/\s+/g, ' ').trim();
      if (!plain) continue;
      if (plain.length <= maxLength) return plain;
      const cut = plain.slice(0, maxLength);
      const lastSpace = cut.lastIndexOf(' ');
      return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}...`;
    }
  }
  return '';
}

/**
 * Flattens a DocumentModel back to plain text, in document order, for the exact-text
 * conservation gate. Order-preserving: every block contributes its literal words in the order
 * they appear. Applies the exact same normalisation rules as stripMarkdownSyntax (inline `**`
 * removal; `label: value` kept with its colon) so a block that classified as `paragraph`
 * because it didn't fit any richer type still normalises identically to the raw-source side of
 * the comparison.
 */
function flattenToPlainText(model) {
  const parts = [];
  for (const section of model.sections) {
    if (section.heading) parts.push(stripMarkdownSyntax(section.heading));
    for (const block of section.blocks) {
      switch (block.type) {
        case 'subheading':
          parts.push(stripMarkdownSyntax(block.text));
          break;
        case 'paragraph':
          parts.push(stripMarkdownSyntax(block.text));
          break;
        case 'list':
          parts.push(...block.items.map(stripInline));
          break;
        case 'table':
          for (const row of block.rows) parts.push(...row.map(stripInline));
          break;
        case 'specTable':
          for (const e of block.entries) parts.push(`${stripInline(e.label)}: ${stripInline(e.text)}`);
          break;
        case 'callout':
          parts.push(`${stripInline(block.marker)}: ${stripInline(block.text)}`);
          break;
        case 'comparison':
          for (const p of block.pairs) parts.push(`${stripInline(p.label)}: ${stripInline(p.text)}`);
          break;
        case 'timeline':
          for (const s of block.steps) parts.push(`${stripInline(s.label)}: ${stripInline(s.text)}`);
          break;
        default:
          throw new Error(`flattenToPlainText: unhandled block type "${block.type}"`);
      }
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strips markdown syntax from a raw body to produce the same "words in order" text that
 * flattenToPlainText should equal — the other half of the exact-text conservation gate.
 */
function stripMarkdownSyntax(body) {
  return body
    .split('\n')
    .filter((line) => !/^\|[\s:|-]+\|\s*$/.test(line)) // table separator rows carry no words
    .map((line) => {
      let l = line;
      l = l.replace(/^#{1,6}\s+/, '');
      l = l.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
      const tableMatch = /^\|(.+)\|\s*$/.exec(l);
      if (tableMatch) l = tableMatch[1].split('|').join(' ');
      l = l.replace(/\*\*/g, '');
      return l;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { parseDocument, flattenToPlainText, stripMarkdownSyntax, summaryFromModel, slugify, slugKey, TAXONOMY };
