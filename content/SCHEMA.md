# content/ authoring schema

The authoring contract for `content/topics/*.md` and `content/study-materials/*.md`, parsed by
`scripts/content/parseDocument.js` — the one parser (Phase 1,
`docs/plans/write-the-phased-plan-wobbly-pancake.md`). This file documents which markdown shape
produces which `DocumentModel` block type. Block `type` is a plain string, not a fixed enum
(decision D1 in the plan): **an unrecognised type must be rendered as `paragraph` on every
platform**, so a new block type never breaks an older shipped app.

## Document structure

- Frontmatter (`--- ... ---`) is parsed by `scripts/content/parseContentFile.js` and is not part
  of the body the block parser sees.
- The body is split into **sections** at `##` (level-2) headings only. A file with no `##` at
  all becomes a single section with `heading: null`.
- Any other heading level found in the body (`#`, `###`–`######`) does **not** start a new
  section — it becomes a `subheading` block inside the current section.
- Section anchor `slug`s are pinned in `content/slugs.lock.json` on first sight and never
  re-derived from heading text afterwards — see that file's header comment and
  `scripts/content/buildSlugLock.js`.

## Block taxonomy

| Block | Markdown shape | Example (from real content) |
|---|---|---|
| `paragraph` | Plain prose; the fallback for anything that doesn't fit another type | `study-materials/psy_6.md`: "Officer Like Qualities represent an integrated whole..." |
| `list` | A run of lines starting with `-`, `*`, or `1.` | `study-materials/oir_2.md`: `- Understand relationships between concepts` |
| `specTable` | A run of 2+ `**Label**: value` lines whose labels aren't callout/comparison/timeline keywords | `study-materials/gto_2.md`: `**Duration**: 20-30 minutes` / `**Group Size**: 8-10 candidates` |
| `callout` | A single `**Remember**:` / `**Key Insight**:` / `**Tip**:` / `**Warning**:` / `**Note**:` line | `study-materials/gto_2.md`: `**Remember**: GTO wants to see a team player...` |
| `comparison` | `**Wrong**:` / `**Right**:` pairs, `**Myth N**:` / `**Reality**:` pairs, or `**Problem**:` / `**Solution**:` pairs | `study-materials/psy_3.md`: `**Wrong**: "Courage means bravery..."` / `**Right**: "I show courage when..."` |
| `timeline` | `**<time>**:` (e.g. `9:00 AM`) or `**<N Period Before/After>**:` step lines | `study-materials/psy_1.md`: `**9:00 AM**: Reporting and briefing` |
| `table` | A standard markdown pipe table (header row + `|---|---|` separator) | `study-materials/med_3.md`: the "General Preparation Timeline" table |
| `subheading` | Any heading line (`#`, `###`+) that isn't a section-starting `##` | `study-materials/psy_3.md`: `### Mistake 1: Dictionary Definitions` |

**The parser never drops content.** Every line of the body is assigned to exactly one block; a
line that doesn't match a richer type is kept verbatim inside a `paragraph` block. This is
enforced by the exact-text conservation test in `scripts/test/content-parser.test.js` — it flattens
the parsed model back to plain text and asserts it equals the syntax-stripped source, for every
file in the real corpus.

## Ambiguous label runs

`**Label**: value` lines are classified by their label, in this priority order: `callout` (single
line, exact keyword match) → `comparison` (Wrong/Right/Myth N/Reality/Problem/Solution/Positive
or Negative Indicators) → `timeline` (a clock time or a "N `<unit>` Before/After" phrase) →
`specTable` (2+ lines, no other match). A single standalone label line that isn't a callout
keyword becomes a `paragraph`, unchanged from today's rendering. Adjacent chunks that resolve to
the same run type (`specTable`, `comparison`, `timeline`) are merged into one block, so e.g. five
consecutive Myth/Reality pairs become one `comparison` block with 5 `pairs`, not five blocks.

## Slug lockfile format

`content/slugs.lock.json` maps `"<path-relative-to-content/>#<section-index-or-root>"` →
`"<slug>"`. `root` is used for the single section of a file with no `##` headings (e.g. today's
topic intros before Phase 3 normalises them). The index is the section's 0-based position among
`##` headings in the file — reordering or removing a `##` section changes its key, which is
exactly the "explicit migration entry" the parser requires when a previously-pinned key
disappears (see `parseDocument.js`'s slug-pin check). Run
`node scripts/content/buildSlugLock.js` to regenerate it, or `--check` to verify it's current
without writing (wired into `npm run test:content` / CI).
