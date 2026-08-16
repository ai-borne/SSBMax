/**
 * Phase 1 (Web SSB Test Flow Parity plan): tests for `src/evaluation/validation.js`,
 * a port of shared/.../domain/validation/SSBScoreValidator.kt + ValidationIntegration.kt.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  exceedsMaxLimitations,
  detectCriticalWeaknesses,
  checkFactorConsistency,
  validateScores
} = require('../src/evaluation/validation');

function cleanScores(overrides = {}) {
  // 15 OLQs, all a clean "5" (no limitations, fully consistent within each factor).
  const base = {
    EFFECTIVE_INTELLIGENCE: 5, REASONING_ABILITY: 5, ORGANIZING_ABILITY: 5, POWER_OF_EXPRESSION: 5,
    SOCIAL_ADJUSTMENT: 5, COOPERATION: 5, SENSE_OF_RESPONSIBILITY: 5,
    INITIATIVE: 5, SELF_CONFIDENCE: 5, SPEED_OF_DECISION: 5, INFLUENCE_GROUP: 5, LIVELINESS: 5,
    DETERMINATION: 5, COURAGE: 5, STAMINA: 5
  };
  return { ...base, ...overrides };
}

function asOlqScoreMap(scoreMap) {
  const result = {};
  for (const [id, score] of Object.entries(scoreMap)) {
    result[id] = { score, confidence: 80, reasoning: 'test' };
  }
  return result;
}

test('Phase 1: exceedsMaxLimitations respects each entry type\'s threshold (NDA=4, OTA/GRADUATE=7)', () => {
  const fiveLimitations = cleanScores({
    EFFECTIVE_INTELLIGENCE: 8, ORGANIZING_ABILITY: 8, POWER_OF_EXPRESSION: 8, INITIATIVE: 8, SELF_CONFIDENCE: 8
  });
  assert.equal(exceedsMaxLimitations(fiveLimitations, 'NDA'), true, 'NDA max is 4, 5 limitations exceeds it');
  assert.equal(exceedsMaxLimitations(fiveLimitations, 'OTA'), false, 'OTA max is 7, 5 limitations is within it');
  assert.equal(exceedsMaxLimitations(fiveLimitations, 'GRADUATE'), false, 'GRADUATE max is 7, same as OTA');
});

test('Phase 1: detectCriticalWeaknesses flags a limitation on any of the 6 critical OLQs', () => {
  const scores = cleanScores({ COURAGE: 8 });
  const result = detectCriticalWeaknesses(scores);
  assert.deepEqual(result.criticalWeaknesses, ['COURAGE']);
  assert.equal(result.hasAutoRejectWeakness, false, 'a single Factor IV critical weakness is not itself an auto-reject');
});

test('Phase 1: Factor II average >= 8 is an auto-reject, independent of individual limitation counting', () => {
  const scores = cleanScores({ SOCIAL_ADJUSTMENT: 8, COOPERATION: 8, SENSE_OF_RESPONSIBILITY: 8 });
  const result = detectCriticalWeaknesses(scores);
  assert.equal(result.hasAutoRejectWeakness, true);
  assert.match(result.autoRejectReason, /8\.0/);
});

test('Phase 1: checkFactorConsistency treats exactly the tick-variation boundary as consistent, one over as not', () => {
  // Factor I (Intellectual) allows +-1: EI=5, RA=6 is variation 1 -> consistent.
  const atBoundary = checkFactorConsistency(cleanScores({ REASONING_ABILITY: 6 }));
  assert.equal(atBoundary.isConsistent, true);

  // EI=5, RA=7 is variation 2 -> exceeds Factor I's +-1 -> inconsistent.
  const overBoundary = checkFactorConsistency(cleanScores({ REASONING_ABILITY: 7 }));
  assert.equal(overBoundary.isConsistent, false);
  assert.deepEqual(overBoundary.inconsistentFactors, [1]);

  // Factor III (Dynamic) allows +-2: INITIATIVE=5, LIVELINESS=7 is variation 2 -> still consistent.
  const lenientAtBoundary = checkFactorConsistency(cleanScores({ LIVELINESS: 7 }));
  assert.equal(lenientAtBoundary.isConsistent, true);
});

test('Phase 1: validateScores R14 override -- any limitation at all forces NOT_RECOMMENDED even if otherwise clean and consistent', () => {
  // A single limitation, well under NDA's max of 4, with no critical weakness and full consistency.
  const scores = asOlqScoreMap(cleanScores({ STAMINA: 8 }));
  const result = validateScores(scores, 'NDA');
  assert.equal(result.limitationCount, 1);
  assert.equal(result.exceedsMaxLimitations, false, 'sanity check: 1 limitation does not exceed NDA max of 4');
  assert.equal(result.recommendation, 'NOT_RECOMMENDED', 'R14: any limitation overrides an otherwise-passing outcome');
});

test('Phase 1: validateScores recommends RECOMMENDED for a fully clean, consistent score set', () => {
  const scores = asOlqScoreMap(cleanScores());
  const result = validateScores(scores, 'NDA');
  assert.equal(result.recommendation, 'RECOMMENDED');
  assert.equal(result.summary, 'Scores pass all validation criteria');
});

test('Phase 1: validateScores marks isValid=false when more than 1 OLQ is missing', () => {
  const scores = asOlqScoreMap(cleanScores());
  delete scores.STAMINA;
  delete scores.COURAGE;
  const result = validateScores(scores, 'NDA');
  assert.equal(result.isValid, false, 'only 1 missing OLQ is tolerated, 2 is not');
});

test('Phase 1: validateScores returns an explicit invalid result for empty input', () => {
  const result = validateScores({}, 'NDA');
  assert.equal(result.isValid, false);
  assert.equal(result.recommendation, 'NOT_RECOMMENDED');
  assert.equal(result.summary, 'No scores provided');
});
