/**
 * CI drift gate for scripts/content/generateKmpFallback.js (Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md), mirroring generate-contracts.test.js's own
 * "regenerate && diff is clean" check. TopicContentLoader.kt / TopicIntro*.kt are KMP's only
 * offline guarantee (root CLAUDE.md, HIGH 4b) and must never silently drift from
 * content/topics/*.md -- before this test existed, that drift had already happened once (Phase
 * 3's heading rewrite was never propagated to the generated Kotlin) and nothing caught it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { generate } = require('../content/generateKmpFallback');

test('generateKmpFallback: the committed TopicContentLoader.kt / TopicIntro*.kt are exactly what regenerating from content/topics/*.md produces', () => {
  const drifted = generate({ check: true });
  assert.deepEqual(
    drifted,
    [],
    `KMP offline fallback has drifted from content/topics/*.md. Run ` +
    `\`node scripts/content/generateKmpFallback.js\` and commit the result. Drifted file(s):\n` +
    drifted.map((f) => `  - ${f}`).join('\n')
  );
});
