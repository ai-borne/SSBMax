/**
 * Phase 1 (Web SSB Test Flow Parity plan): tests for `src/evaluation/olqPrompts.js`,
 * a port of shared/.../domain/prompts/SSBPromptCore.kt's shared scaffolding.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const olqPrompts = require('../src/evaluation/olqPrompts');

test('Phase 1: getFactorContextPrompt covers all 4 factors and marks all 6 critical OLQs', () => {
  const prompt = olqPrompts.getFactorContextPrompt();
  ['Factor I', 'Factor II', 'Factor III', 'Factor IV'].forEach((f) => assert.ok(prompt.includes(f), f));
  const criticalCount = (prompt.match(/\[CRITICAL\]/g) || []).length;
  assert.equal(criticalCount, 6, 'exactly the 6 critical OLQs (RA, SA, CO-OP, SoR, LIV, COU) must be marked');
});

test('Phase 1: getFactorContextForCategory calls out Factor II as auto-reject-critical, others not', () => {
  const social = olqPrompts.getFactorContextForCategory('SOCIAL');
  assert.match(social, /automatically rejected/);
  const intellectual = olqPrompts.getFactorContextForCategory('INTELLECTUAL');
  assert.doesNotMatch(intellectual, /automatically rejected/);
});

test('Phase 1: getFactorContextForCategory states the correct tick-variation for strict vs lenient factors', () => {
  assert.match(olqPrompts.getFactorContextForCategory('SOCIAL'), /±1 tick/);
  assert.match(olqPrompts.getFactorContextForCategory('DYNAMIC'), /±2 tick/);
});

test('Phase 1: getCriticalQualityWarningForOLQ is empty for a non-critical OLQ, populated for a critical one', () => {
  assert.equal(olqPrompts.getCriticalQualityWarningForOLQ('STAMINA'), '');
  assert.notEqual(olqPrompts.getCriticalQualityWarningForOLQ('COURAGE'), '');
});

test('Phase 1: getCompleteSSBContext assembles every section', () => {
  const context = olqPrompts.getCompleteSSBContext();
  assert.match(context, /SSB Scoring Scale/);
  assert.match(context, /SSB Factor Structure/);
  assert.match(context, /Critical Quality Alert/);
  assert.match(context, /Factor Consistency Rules/);
  assert.match(context, /Limitation System/);
});
