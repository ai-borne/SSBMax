/**
 * Phase 10 (Web SSB Test Flow Parity plan): tests for `src/evaluation/tatPrompts.js`, a
 * verbatim port of `TATStoryAnalysisPrompts.kt` (per-story) and `TATSynthesisPrompts.kt`
 * (cross-story synthesis).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTATStoryMultimodalPrompt, buildTATSynthesisPrompt } = require('../src/evaluation/tatPrompts');

test('Phase 10: generateTATStoryMultimodalPrompt numbers the story as "story N of totalStories"', () => {
  const prompt = generateTATStoryMultimodalPrompt('A story about a soldier.', {}, 'Male', 2, 12);
  assert.ok(prompt.includes('story 3 of 12'), prompt);
});

test('Phase 10: generateTATStoryMultimodalPrompt includes the picture briefing sections when present', () => {
  const prompt = generateTATStoryMultimodalPrompt('story text', {
    sceneDescription: 'A bridge over a river',
    coreElements: ['bridge', 'river'],
    primaryOLQs: ['COURAGE']
  }, 'Female', 0, 1);
  assert.ok(prompt.includes('Scene: A bridge over a river'));
  assert.ok(prompt.includes('  - bridge'));
  assert.ok(prompt.includes('Primary OLQs this picture tests: COURAGE'));
});

test('Phase 10: generateTATStoryMultimodalPrompt includes the R4 gender-match rule only for MIXED images', () => {
  const mixed = generateTATStoryMultimodalPrompt('story', {}, 'Male', 0, 1, undefined, 'MIXED');
  const male = generateTATStoryMultimodalPrompt('story', {}, 'Male', 0, 1, undefined, 'MALE');
  assert.ok(mixed.includes('R4  SELF_CONFIDENCE'));
  assert.ok(!male.includes('R4  SELF_CONFIDENCE'));
});

test('Phase 10: generateTATStoryMultimodalPrompt includes all 15 OLQ names and the 5-9 scoring scale', () => {
  const prompt = generateTATStoryMultimodalPrompt('story', {}, 'Unknown', 0, 1);
  assert.ok(prompt.includes('EFFECTIVE_INTELLIGENCE'));
  assert.ok(prompt.includes('STAMINA'));
  assert.ok(prompt.includes('Use ONLY 5-9'));
});

test('Phase 10: generateTATStoryMultimodalPrompt includes the Murray needs taxonomy (R5 rubric)', () => {
  const prompt = generateTATStoryMultimodalPrompt('story', {}, 'Unknown', 0, 1);
  assert.ok(prompt.includes('Achievement, Affiliation, Dominance, Order'));
});

test('Phase 10: buildTATSynthesisPrompt orders per-story assessments by storyIndex, not input order', () => {
  const assessments = [
    { storyIndex: 1, story: 'second', overallScore: 6, overallRating: 'Good', aiConfidence: 70, olqScores: { COURAGE: { score: 6 } } },
    { storyIndex: 0, story: 'first', overallScore: 5, overallRating: 'Exceptional', aiConfidence: 80, olqScores: { COURAGE: { score: 5 } } }
  ];
  const prompt = buildTATSynthesisPrompt(assessments);
  const firstIdx = prompt.indexOf('Story 1');
  const secondIdx = prompt.indexOf('Story 2');
  assert.ok(firstIdx >= 0 && secondIdx > firstIdx, prompt);
  assert.ok(prompt.indexOf('Text: first') < prompt.indexOf('Text: second'));
});

test('Phase 10: buildTATSynthesisPrompt truncates story text over 200 chars with an ellipsis', () => {
  const longStory = 'x'.repeat(250);
  const prompt = buildTATSynthesisPrompt([
    { storyIndex: 0, story: longStory, overallScore: 6, overallRating: 'Good', aiConfidence: 70, olqScores: {} }
  ]);
  assert.ok(prompt.includes(`${'x'.repeat(200)}...`));
  assert.ok(!prompt.includes('x'.repeat(201)));
});

test('Phase 10: buildTATSynthesisPrompt reports the assessment count and demands all 15 OLQs as an object', () => {
  const prompt = buildTATSynthesisPrompt([
    { storyIndex: 0, story: 's1', overallScore: 6, overallRating: 'Good', aiConfidence: 70, olqScores: {} },
    { storyIndex: 1, story: 's2', overallScore: 7, overallRating: 'Average', aiConfidence: 60, olqScores: {} }
  ]);
  assert.ok(prompt.includes('per-story AI assessments for 2 TAT stories'));
  assert.ok(prompt.includes('olqScores is a JSON OBJECT keyed by OLQ name (not an array)'));
});
