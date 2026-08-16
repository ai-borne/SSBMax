/**
 * SSB score validation (Phase 1, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../domain/validation/SSBScoreValidator.kt` +
 * `ValidationIntegration.kt`. OLQ id/displayName/category/critical come from
 * `generated/contracts.cjs Enums.OLQ` (the SSOT, per `olqDefinitions.js`'s own
 * precedent) -- only the factor-number/tick-variation metadata below is added,
 * since the contract doesn't carry it.
 */

const { Enums } = require('../generated/contracts.cjs');

const LIMITATION_THRESHOLD = 8;
const FACTOR_II_CRITICAL_THRESHOLD = 8;

const MAX_LIMITATIONS_BY_ENTRY_TYPE = {
  NDA: 4,
  OTA: 7,
  GRADUATE: 7
};

/** Factor I/II: strict ±1 tick. Factor III/IV: lenient ±2 tick. */
const CATEGORY_META = {
  INTELLECTUAL: { factorNumber: 1, factorName: 'Planning & Organizing', maxTickVariation: 1, isCriticalFactor: false },
  SOCIAL: { factorNumber: 2, factorName: 'Social Adjustment', maxTickVariation: 1, isCriticalFactor: true },
  DYNAMIC: { factorNumber: 3, factorName: 'Social Effectiveness', maxTickVariation: 2, isCriticalFactor: false },
  CHARACTER: { factorNumber: 4, factorName: 'Dynamic', maxTickVariation: 2, isCriticalFactor: false }
};

function isLimitation(score) {
  return score >= LIMITATION_THRESHOLD;
}

function maxLimitationsFor(entryType) {
  const max = MAX_LIMITATIONS_BY_ENTRY_TYPE[entryType];
  if (max === undefined) {
    throw new Error(`Unknown entryType: ${entryType}`);
  }
  return max;
}

/** @param scores Map of OLQ id -> score (1-10, lower is better) */
function countLimitations(scores) {
  const limitedIds = Object.keys(scores).filter((olqId) => isLimitation(scores[olqId]));
  return { count: limitedIds.length, limitedOLQs: limitedIds };
}

function exceedsMaxLimitations(scores, entryType) {
  return countLimitations(scores).count > maxLimitationsFor(entryType);
}

function checkFactorConsistency(scores) {
  const inconsistentFactors = [];
  const details = {};
  let maxVariationFound = 0;

  for (const [category, meta] of Object.entries(CATEGORY_META)) {
    const factorScores = Object.keys(scores)
      .filter((olqId) => Enums.OLQ[olqId] && Enums.OLQ[olqId].category === category)
      .map((olqId) => scores[olqId]);

    if (factorScores.length >= 2) {
      const min = Math.min(...factorScores);
      const max = Math.max(...factorScores);
      const variation = max - min;
      if (variation > maxVariationFound) {
        maxVariationFound = variation;
      }
      const isConsistent = variation <= meta.maxTickVariation;
      if (!isConsistent) {
        inconsistentFactors.push(meta.factorNumber);
      }
      details[category] = { minScore: min, maxScore: max, variation, isConsistent };
    }
  }

  return { isConsistent: inconsistentFactors.length === 0, inconsistentFactors, maxVariationFound, details };
}

function detectCriticalWeaknesses(scores) {
  const criticalWeaknesses = Object.keys(scores).filter(
    (olqId) => Enums.OLQ[olqId] && Enums.OLQ[olqId].critical && isLimitation(scores[olqId])
  );

  const factorIIScores = Object.keys(scores)
    .filter((olqId) => Enums.OLQ[olqId] && Enums.OLQ[olqId].category === 'SOCIAL')
    .map((olqId) => scores[olqId]);

  let hasAutoRejectWeakness = false;
  let autoRejectReason = null;
  if (factorIIScores.length > 0) {
    const factorIIAverage = factorIIScores.reduce((a, b) => a + b, 0) / factorIIScores.length;
    hasAutoRejectWeakness = factorIIAverage >= FACTOR_II_CRITICAL_THRESHOLD;
    if (hasAutoRejectWeakness) {
      autoRejectReason =
        `Factor II (Social Adjustment) average score is ${factorIIAverage.toFixed(1)}, ` +
        `which meets or exceeds the critical threshold of ${FACTOR_II_CRITICAL_THRESHOLD}. ` +
        'This is an automatic rejection criterion per SSB rules.';
    }
  }

  return { criticalWeaknesses, hasAutoRejectWeakness, autoRejectReason };
}

function factorAverages(scores) {
  const result = {};
  for (const [category, meta] of Object.entries(CATEGORY_META)) {
    const factorScores = Object.keys(scores)
      .filter((olqId) => Enums.OLQ[olqId] && Enums.OLQ[olqId].category === category)
      .map((olqId) => scores[olqId]);
    result[meta.factorNumber] = factorScores.length > 0 ? factorScores.reduce((a, b) => a + b, 0) / factorScores.length : 0;
  }
  return result;
}

/**
 * NOT_RECOMMENDED if exceeds max limitations or Factor II auto-reject;
 * BORDERLINE (DOUBTFUL) if factor-inconsistent or has a critical weakness
 * that isn't itself an auto-reject; else RECOMMENDED.
 */
function determineRecommendation(scores, entryType) {
  const exceedsLimitations = exceedsMaxLimitations(scores, entryType);
  const critical = detectCriticalWeaknesses(scores);
  const consistency = checkFactorConsistency(scores);

  if (exceedsLimitations || critical.hasAutoRejectWeakness) {
    return 'NOT_RECOMMENDED';
  }
  if (!consistency.isConsistent || critical.criticalWeaknesses.length > 0) {
    return 'BORDERLINE';
  }
  return 'RECOMMENDED';
}

/**
 * @param scores Map of OLQ id -> { score, confidence, reasoning }
 * @param entryType 'NDA' | 'OTA' | 'GRADUATE'
 */
function validateScores(scores, entryType) {
  const olqIds = Object.keys(scores || {});
  if (olqIds.length === 0) {
    return invalidResult('No scores provided');
  }

  const scoreMap = {};
  for (const olqId of olqIds) {
    scoreMap[olqId] = scores[olqId].score;
  }

  const limitationResult = countLimitations(scoreMap);
  const exceedsMax = exceedsMaxLimitations(scoreMap, entryType);
  const critical = detectCriticalWeaknesses(scoreMap);
  const consistency = checkFactorConsistency(scoreMap);
  const averages = factorAverages(scoreMap);

  // R14: any limitation at all overrides determineRecommendation's own outcome.
  const recommendation = limitationResult.count > 0 ? 'NOT_RECOMMENDED' : determineRecommendation(scoreMap, entryType);

  const summaryParts = [];
  if (limitationResult.count > 0) summaryParts.push(`${limitationResult.count} limitation(s)`);
  if (critical.criticalWeaknesses.length > 0) summaryParts.push('Critical OLQ weakness');
  if (critical.hasAutoRejectWeakness) summaryParts.push('Factor II auto-reject');
  if (!consistency.isConsistent) summaryParts.push('Factor inconsistency detected');

  return {
    isValid: olqIds.length >= 14, // Allow 1 missing OLQ
    limitationCount: limitationResult.count,
    limitationOLQs: limitationResult.limitedOLQs,
    exceedsMaxLimitations: exceedsMax,
    hasCriticalWeakness: critical.criticalWeaknesses.length > 0,
    criticalWeaknessOLQs: critical.criticalWeaknesses,
    factorIIAutoReject: critical.hasAutoRejectWeakness,
    hasFactorInconsistency: !consistency.isConsistent,
    inconsistentFactors: consistency.inconsistentFactors,
    factorAverages: averages,
    recommendation,
    summary: summaryParts.length > 0 ? summaryParts.join('; ') : 'Scores pass all validation criteria'
  };
}

function invalidResult(reason) {
  return {
    isValid: false,
    limitationCount: 0,
    limitationOLQs: [],
    exceedsMaxLimitations: false,
    hasCriticalWeakness: false,
    criticalWeaknessOLQs: [],
    factorIIAutoReject: false,
    hasFactorInconsistency: false,
    inconsistentFactors: [],
    factorAverages: {},
    recommendation: 'NOT_RECOMMENDED',
    summary: reason
  };
}

module.exports = {
  LIMITATION_THRESHOLD,
  FACTOR_II_CRITICAL_THRESHOLD,
  MAX_LIMITATIONS_BY_ENTRY_TYPE,
  CATEGORY_META,
  isLimitation,
  maxLimitationsFor,
  countLimitations,
  exceedsMaxLimitations,
  checkFactorConsistency,
  detectCriticalWeaknesses,
  factorAverages,
  determineRecommendation,
  validateScores
};
