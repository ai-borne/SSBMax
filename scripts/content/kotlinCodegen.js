/**
 * Renders a parseDocument.js `DocumentModel` ({ sections: [...] }) as a Kotlin expression
 * literal -- `DocumentModel(sections = listOf(DocSection(...), ...))` -- for
 * generateKmpFallback.js's structured offline fallback (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md). Split out of generateKmpFallback.js purely to keep
 * both files under the repo's 300-LOC Quality Limit.
 *
 * Mirrors `shared/.../ui/content/blocks/DocBlock.kt`'s constructor shapes exactly -- this is
 * the one place a KMP `DocumentModel` is built from JS-parsed data as source code (not JSON
 * decoded at runtime), so a field added to DocBlock.kt without a matching case here fails loud
 * at Kotlin compile time, not silently at runtime.
 */

const WRAP_WIDTH = 100;

/** Escapes a string for a Kotlin double-quoted literal: backslash, `"`, and `$` (template escape). */
function escapeKotlinString(text) {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
}

/** Wraps `text` into `"..." +\n"..."`-style Kotlin string-concatenation lines, each under WRAP_WIDTH content chars. */
function kotlinString(text, pad) {
  const escaped = escapeKotlinString(text);
  const words = escaped.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > WRAP_WIDTH && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 1) return `"${lines[0] ?? ''}"`;
  return lines.map((l, i) => `${i === 0 ? '' : pad}"${l}${i === lines.length - 1 ? '' : ' '}"`).join(' +\n');
}

function kotlinStringOrNull(text, pad) {
  return text === null || text === undefined ? 'null' : kotlinString(text, pad);
}

function labelValue(pair, pad) {
  return `LabelValue(label = ${kotlinString(pair.label, pad)}, text = ${kotlinString(pair.text, pad)})`;
}

/** Renders one block. `pad` is the indent string for continuation lines inside this block's call. */
function blockToKotlin(block, pad) {
  const inner = pad + '    ';
  switch (block.type) {
    case 'paragraph':
      return `ParagraphBlock(${kotlinString(block.text, inner)})`;
    case 'list':
      return `ListBlock(items = listOf(\n${inner}${block.items.map((i) => kotlinString(i, inner)).join(`,\n${inner}`)}\n${pad}))`;
    case 'subheading':
      return `SubheadingBlock(level = ${block.level}, text = ${kotlinString(block.text, inner)})`;
    case 'specTable':
      return `SpecTableBlock(entries = listOf(\n${inner}${block.entries.map((e) => labelValue(e, inner)).join(`,\n${inner}`)}\n${pad}))`;
    case 'callout':
      return `CalloutBlock(marker = ${kotlinString(block.marker, inner)}, text = ${kotlinString(block.text, inner)})`;
    case 'comparison':
      return `ComparisonBlock(pairs = listOf(\n${inner}${block.pairs.map((p) => labelValue(p, inner)).join(`,\n${inner}`)}\n${pad}))`;
    case 'timeline':
      return `TimelineBlock(steps = listOf(\n${inner}${block.steps.map((s) => labelValue(s, inner)).join(`,\n${inner}`)}\n${pad}))`;
    case 'table':
      return `TableBlock(rows = listOf(\n${inner}${block.rows.map((r) => `listOf(${r.map((c) => kotlinString(c, inner)).join(', ')})`).join(`,\n${inner}`)}\n${pad}))`;
    default:
      // D1: an unrecognised type from the parser's own frozen TAXONOMY should never occur, but
      // fail loud at generation time rather than emitting invalid Kotlin.
      throw new Error(`kotlinCodegen: unrecognised block type "${block.type}" -- update blockToKotlin`);
  }
}

function sectionToKotlin(section, pad) {
  const inner = pad + '    ';
  const blocksInner = inner + '    ';
  const blocksKt = section.blocks.map((b) => blockToKotlin(b, blocksInner)).join(`,\n${blocksInner}`);
  return `DocSection(\n${inner}id = ${kotlinString(section.id, inner)},\n${inner}slug = ${kotlinString(section.slug, inner)},\n${inner}heading = ${kotlinStringOrNull(section.heading, inner)},\n${inner}level = ${section.level},\n${inner}blocks = listOf(\n${blocksInner}${blocksKt}\n${inner})\n${pad})`;
}

/** Renders `model` ({ sections: [...] }) as a `DocumentModel(...)` Kotlin expression, indented by `pad` (the column its opening line starts at). */
function documentModelToKotlin(model, pad = '') {
  const inner = pad + '    ';
  const sectionsKt = model.sections.map((s) => sectionToKotlin(s, inner)).join(`,\n${inner}`);
  return `DocumentModel(\n${inner}sections = listOf(\n${inner}    ${sectionsKt}\n${inner})\n${pad})`;
}

module.exports = { documentModelToKotlin };
