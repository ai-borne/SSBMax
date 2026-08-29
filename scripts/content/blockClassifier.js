/**
 * Classifies a single markdown "chunk" (a blank-line/heading-delimited unit of text within a
 * section, see parseDocument.js) into a DocumentModel block. Pure, no I/O.
 *
 * D1 (docs/plans/write-the-phased-plan-wobbly-pancake.md): block.type is a plain string, not an
 * enum — any type a renderer doesn't recognise must fall back to `paragraph` on both platforms.
 * This module only ever emits the frozen taxonomy below; it never invents a new type name.
 */

const TAXONOMY = ['paragraph', 'list', 'specTable', 'callout', 'comparison', 'timeline', 'table', 'subheading'];

const CALLOUT_MARKERS = new Set(['Remember', 'Key Insight', 'Tip', 'Warning', 'Note']);
const COMPARISON_LABEL_RE = /^(Wrong|Right|Myth\s*\d*|Reality|Problem|Solution|Positive Indicators?|Negative Indicators?)$/;
const TIMELINE_LABEL_RE = /^(\d{1,2}(:\d{2})?\s?(AM|PM)|.+\b(Before|After))$/;
const LABEL_LINE_RE = /^\*\*([^*]+)\*\*:\s?(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;
const TABLE_ROW_RE = /^\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\|[\s:|-]+\|\s*$/;

/** Splits a chunk's lines into label/value pairs if EVERY line matches `**Label**: value`. */
function extractLabelRun(lines) {
  const pairs = [];
  for (const line of lines) {
    const m = LABEL_LINE_RE.exec(line);
    if (!m) return null;
    pairs.push({ label: m[1].trim(), text: m[2].trim() });
  }
  return pairs;
}

function classifyHeading(line) {
  const m = HEADING_RE.exec(line);
  return { type: 'subheading', level: m[1].length, text: m[2].trim() };
}

function classifyTable(lines) {
  const rows = lines.filter((l) => !TABLE_SEP_RE.test(l)).map((l) => {
    const m = TABLE_ROW_RE.exec(l);
    return m[1].split('|').map((cell) => cell.trim());
  });
  return { type: 'table', rows };
}

function classifyList(lines) {
  const items = lines.map((l) => LIST_ITEM_RE.exec(l)[1].trim());
  return { type: 'list', items };
}

/** Classifies one chunk (array of non-empty lines, already isolated by parseDocument.js). */
function classifyChunk(lines) {
  if (lines.length === 1 && HEADING_RE.test(lines[0])) {
    return classifyHeading(lines[0]);
  }
  if (lines.length >= 2 && lines.every((l) => TABLE_ROW_RE.test(l) || TABLE_SEP_RE.test(l))) {
    return classifyTable(lines);
  }
  if (lines.every((l) => LIST_ITEM_RE.test(l))) {
    return classifyList(lines);
  }
  const pairs = extractLabelRun(lines);
  if (pairs) {
    const labels = pairs.map((p) => p.label);
    if (pairs.length === 1 && CALLOUT_MARKERS.has(labels[0])) {
      return { type: 'callout', marker: labels[0], text: pairs[0].text };
    }
    if (labels.every((l) => COMPARISON_LABEL_RE.test(l))) {
      return { type: 'comparison', pairs };
    }
    if (labels.every((l) => TIMELINE_LABEL_RE.test(l))) {
      return { type: 'timeline', steps: pairs };
    }
    if (pairs.length >= 2) {
      return { type: 'specTable', entries: pairs };
    }
  }
  return { type: 'paragraph', text: lines.join('\n') };
}

/**
 * Merges adjacent blocks of the same "run" type (specTable/comparison/timeline) into one block,
 * so e.g. five consecutive Myth/Reality chunks become a single comparison block with 5 pairs,
 * matching the plan's "run of ..." taxonomy language instead of emitting one block per pair.
 */
function mergeRuns(blocks) {
  const merged = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === block.type && prev.type === 'specTable') {
      prev.entries.push(...block.entries);
    } else if (prev && prev.type === block.type && prev.type === 'comparison') {
      prev.pairs.push(...block.pairs);
    } else if (prev && prev.type === block.type && prev.type === 'timeline') {
      prev.steps.push(...block.steps);
    } else {
      merged.push(block);
    }
  }
  return merged;
}

module.exports = { TAXONOMY, classifyChunk, mergeRuns };
