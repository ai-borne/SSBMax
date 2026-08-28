import { describe, it, expect } from 'vitest';
import { parseContentFile, assertPublishable, PLACEHOLDER_BODY, loadTopics, loadStudyMaterials } from '../../../scripts/loadContent.mjs';

describe('parseContentFile', () => {
  it('parses frontmatter + body to the exact expected structure', () => {
    const raw = ['---', 'id: "OIR"', 'isPremium: false', 'version: 2', 'tags: ["a","b"]', '---', '', 'Line one.', ''].join('\n');
    const { meta, body } = parseContentFile(raw, 'fixture.md');
    expect(meta).toEqual({ id: 'OIR', isPremium: false, version: 2, tags: ['a', 'b'] });
    expect(body).toBe('Line one.');
  });

  it('throws when the --- frontmatter block is missing', () => {
    expect(() => parseContentFile('no frontmatter here', 'bad.md')).toThrow(/missing --- frontmatter/);
  });
});

describe('assertPublishable', () => {
  it('rejects empty body, the placeholder, and short bodies; accepts real prose', () => {
    expect(() => assertPublishable('', 'a.md')).toThrow(/empty body/);
    expect(() => assertPublishable(PLACEHOLDER_BODY, 'b.md')).toThrow(/placeholder/);
    expect(() => assertPublishable('Too short.', 'c.md')).toThrow(/fewer than/);
    expect(() => assertPublishable(new Array(25).fill('word').join(' '), 'd.md')).not.toThrow();
  });
});

// These read the real content/ directory. Counts are structural (one file
// per collection doc, added/removed deliberately) so are safe to assert
// exactly; per-file *validity* is a content-authoring concern that changes
// as content/study-materials/*.md gets filled in (see the escalation in
// docs/plans/ai_search_readiness_phase0_findings.md) — asserted separately
// via `npm run content:validate`, not hardcoded here.
describe('loadTopics / loadStudyMaterials (reads the real content/ directory)', () => {
  it('loads all 9 topic files and 51 study-material files with the expected shape', () => {
    const topics = loadTopics();
    const materials = loadStudyMaterials();
    expect(topics).toHaveLength(9);
    expect(materials).toHaveLength(51);
    for (const t of topics) {
      expect(t.meta.topicType).toBeTruthy();
      expect(typeof t.body).toBe('string');
    }
  });
});
