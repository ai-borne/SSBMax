/**
 * Phase 3 (docs/plans/CrossPlatform_SSOT): pins olqDefinitions.js's generated-from-contract
 * OLQ prompt list. Regression target: a contract OLQ with no authored behavioral note (or a
 * note for an id the contract dropped) would silently produce a Gemini prompt that omits or
 * mislists an OLQ -- exactly the kind of wire fork the plan is closing.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Enums } = require('../src/generated/contracts.cjs');
const { OLQ_DEFINITIONS, OLQ_BEHAVIORAL_NOTES } = require('../src/olqDefinitions');

test('every contract OLQ id has an authored behavioral note, and vice versa', () => {
  const contractIds = new Set(Object.keys(Enums.OLQ));
  const notedIds = new Set(Object.keys(OLQ_BEHAVIORAL_NOTES));

  for (const id of contractIds) {
    assert.ok(notedIds.has(id), `contract OLQ '${id}' has no behavioral note in olqDefinitions.js`);
  }
  for (const id of notedIds) {
    assert.ok(contractIds.has(id), `olqDefinitions.js notes an OLQ '${id}' not present in the contract`);
  }
});

test('OLQ_DEFINITIONS lists all 15 OLQ ids from the contract', () => {
  for (const id of Object.keys(Enums.OLQ)) {
    assert.ok(OLQ_DEFINITIONS.includes(id), `OLQ_DEFINITIONS prompt text is missing '${id}'`);
  }
});

test('OLQ_DEFINITIONS groups OLQs under the contract-true category, not a hand-guessed one', () => {
  // Regression: the old hand-written grouping put INFLUENCE_GROUP under "Social" heading text
  // and SENSE_OF_RESPONSIBILITY under "Character" -- neither matched
  // shared/.../domain/model/interview/OLQ.kt's real categories. Per the KMP-authoritative
  // contract, SENSE_OF_RESPONSIBILITY is SOCIAL and INFLUENCE_GROUP is DYNAMIC.
  const socialSection = OLQ_DEFINITIONS.split('SOCIAL QUALITIES (Factor-II):')[1].split('DYNAMIC QUALITIES')[0];
  assert.ok(socialSection.includes('SENSE_OF_RESPONSIBILITY'), 'SENSE_OF_RESPONSIBILITY must be listed under Social (Factor-II)');
  assert.ok(!socialSection.includes('INFLUENCE_GROUP'), 'INFLUENCE_GROUP belongs under Dynamic (Factor-III), not Social');
});
