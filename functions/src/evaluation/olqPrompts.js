/**
 * Shared SSB prompt scaffolding (Phase 1, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../domain/prompts/SSBPromptCore.kt`'s test-type-agnostic
 * sections only (factor context, critical-quality warning, consistency
 * rules, scoring-scale instructions, limitation guidance). Per-test-type
 * penalizing/boosting-behavior prompts stay out of scope here -- they arrive
 * with each type's own prompt-builder file in later phases (4+). Reuses
 * `olqDefinitions.js`'s `OLQ_BEHAVIORAL_NOTES` rather than re-authoring OLQ
 * descriptions a third time.
 */

const { Enums } = require('../generated/contracts.cjs');
const { OLQ_BEHAVIORAL_NOTES } = require('../olqDefinitions');

const FACTOR_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

const CATEGORY_ORDER = ['INTELLECTUAL', 'SOCIAL', 'DYNAMIC', 'CHARACTER'];
const CATEGORY_META = {
  INTELLECTUAL: { factorNumber: 1, factorName: 'Planning & Organizing', maxTickVariation: 1, isCriticalFactor: false },
  SOCIAL: { factorNumber: 2, factorName: 'Social Adjustment', maxTickVariation: 1, isCriticalFactor: true },
  DYNAMIC: { factorNumber: 3, factorName: 'Social Effectiveness', maxTickVariation: 2, isCriticalFactor: false },
  CHARACTER: { factorNumber: 4, factorName: 'Dynamic', maxTickVariation: 2, isCriticalFactor: false }
};

function olqsInCategory(category) {
  return Object.values(Enums.OLQ).filter((olq) => olq.category === category);
}

function getFactorContextPrompt() {
  return `
## SSB Factor Structure

The 15 Officer-Like Qualities (OLQs) are organized into 4 Factors:

### Factor I: Planning & Organizing (Intellectual Qualities)
- Effective Intelligence (EI): ${OLQ_BEHAVIORAL_NOTES.EFFECTIVE_INTELLIGENCE}
- Reasoning Ability (RA): ${OLQ_BEHAVIORAL_NOTES.REASONING_ABILITY} [CRITICAL]
- Organizing Ability (OA): ${OLQ_BEHAVIORAL_NOTES.ORGANIZING_ABILITY}
- Power of Expression (PoE): ${OLQ_BEHAVIORAL_NOTES.POWER_OF_EXPRESSION}

### Factor II: Social Adjustment (MOST CRITICAL FACTOR)
This factor is paramount - if overall Factor II score = 8, candidate is automatically rejected.
- Social Adjustment (SA): ${OLQ_BEHAVIORAL_NOTES.SOCIAL_ADJUSTMENT} [CRITICAL]
- Cooperation (CO-OP): ${OLQ_BEHAVIORAL_NOTES.COOPERATION} [CRITICAL]
- Sense of Responsibility (SoR): ${OLQ_BEHAVIORAL_NOTES.SENSE_OF_RESPONSIBILITY} [CRITICAL]

### Factor III: Social Effectiveness (Dynamic Qualities)
- Initiative (INI): ${OLQ_BEHAVIORAL_NOTES.INITIATIVE}
- Self-Confidence (SC): ${OLQ_BEHAVIORAL_NOTES.SELF_CONFIDENCE}
- Speed of Decision (SoD): ${OLQ_BEHAVIORAL_NOTES.SPEED_OF_DECISION}
- Ability to Influence Group (AIG): ${OLQ_BEHAVIORAL_NOTES.INFLUENCE_GROUP}
- Liveliness (LIV): ${OLQ_BEHAVIORAL_NOTES.LIVELINESS} [CRITICAL]

### Factor IV: Dynamic (Character & Physical)
- Determination (DET): ${OLQ_BEHAVIORAL_NOTES.DETERMINATION}
- Courage (COU): ${OLQ_BEHAVIORAL_NOTES.COURAGE} [CRITICAL]
- Stamina (STA): ${OLQ_BEHAVIORAL_NOTES.STAMINA}
`.trim();
}

function getFactorContextForCategory(category) {
  const meta = CATEGORY_META[category];
  const olqList = olqsInCategory(category)
    .map((olq) => (olq.critical ? `${olq.displayName} [CRITICAL]` : olq.displayName))
    .join(', ');
  const criticalNote = meta.isCriticalFactor
    ? '\nCRITICAL FACTOR: If overall score for this factor = 8, candidate is automatically rejected.'
    : '';

  return `
### ${meta.factorName} (Factor ${FACTOR_ROMAN[meta.factorNumber]})
OLQs: ${olqList}
Consistency: Scores within this factor should vary by at most ±${meta.maxTickVariation} tick(s).${criticalNote}
`.trim();
}

function getCriticalQualityWarning() {
  return `
## Critical Quality Alert

The following 6 OLQs are CRITICAL - a score of 8 or higher on these qualities
is a serious concern and may lead to rejection:

1. Reasoning Ability (RA) - Factor I
   Core analytical thinking required for officer duties

2. Social Adjustment (SA) - Factor II
   Essential for team integration and unit cohesion

3. Cooperation (CO-OP) - Factor II
   Fundamental for military teamwork

4. Sense of Responsibility (SoR) - Factor II
   Critical for leadership accountability

5. Liveliness (LIV) - Factor III
   Important for maintaining morale and motivation

6. Courage (COU) - Factor IV
   Essential for leadership under pressure

AUTOMATIC REJECTION RULE:
If the overall Factor II (Social Adjustment) average score is 8 or higher,
the candidate is automatically NOT RECOMMENDED, regardless of other scores.
`.trim();
}

/** Returns '' for a non-critical OLQ id, mirroring getCriticalQualityWarningForOLQ. */
function getCriticalQualityWarningForOLQ(olqId) {
  const olq = Enums.OLQ[olqId];
  if (!olq || !olq.critical) return '';
  return `
CRITICAL QUALITY: ${olq.displayName}
This is one of the 6 critical OLQs. A score of 8 or higher indicates a limitation
that may significantly impact the candidate's recommendation.
`.trim();
}

function getFactorConsistencyRules() {
  return `
## Factor Consistency Rules

SSB assessors expect scores within each factor to be internally consistent:

### Strict Factors (±1 tick maximum variation):
- Factor I (Planning & Organizing): EI, RA, OA, PoE should have similar scores
- Factor II (Social Adjustment): SA, CO-OP, SoR should have similar scores

### Lenient Factors (±2 tick maximum variation):
- Factor III (Social Effectiveness): INI, SC, SoD, AIG, LIV can have slightly more variation
- Factor IV (Dynamic): DET, COU, STA can have slightly more variation

WHY THIS MATTERS:
If a candidate shows EI=3 but RA=7, this is a red flag indicating:
- Possible assessment error
- Need for re-evaluation
- Inconsistent behavioral evidence

Always ensure scores within a factor are logically consistent based on observed behaviors.
`.trim();
}

function getScoringScaleInstructions() {
  return `
## SSB Scoring Scale (1-10)

IMPORTANT: Lower scores indicate BETTER performance (inverse scale).

### Score Meanings:
- 1-3: Exceptional (rare, outstanding performance - bell curve tail)
- 4: Excellent (top tier, uncommon)
- 5: Very Good (best common score)
- 6: Good (above average)
- 7: Average (typical performance)
- 8: Below Average / LIMITATION (lowest acceptable, concerning)
- 9-10: Poor (usually results in rejection)

### Distribution Guidelines:
Following a normal bell curve distribution:
- Scores of 1-3: ~5% of candidates (exceptional)
- Scores of 4-5: ~20% of candidates (very good to excellent)
- Scores of 6-7: ~50% of candidates (good to average)
- Scores of 8+: ~25% of candidates (below average to poor)

### Key Threshold:
Score of 8 = LIMITATION
- NDA candidates: Maximum 4 limitations allowed
- OTA/Graduate candidates: Maximum 7 limitations allowed
`.trim();
}

function getLimitationGuidance() {
  return `
## Limitation System

A limitation is defined as any OLQ score of 8 or higher.

### Entry Type Limits:
- NDA (National Defence Academy): Maximum 4 limitations
  - Younger candidates, more potential for development
  - Stricter standards due to longer service commitment

- OTA (Officers Training Academy): Maximum 7 limitations
  - Graduate entry, shorter service
  - More lenient threshold

- Graduate Entry: Maximum 7 limitations
  - Similar to OTA standards

### Impact of Limitations:
1. Each limitation is a concern that assessors note
2. Multiple limitations compound the concern
3. Exceeding the maximum = NOT RECOMMENDED
4. Critical OLQ limitations carry extra weight
`.trim();
}

function getCompleteSSBContext() {
  return `
# SSB Scoring Framework - Complete Reference

${getScoringScaleInstructions()}

${getFactorContextPrompt()}

${getCriticalQualityWarning()}

${getFactorConsistencyRules()}

${getLimitationGuidance()}
`.trim();
}

module.exports = {
  CATEGORY_ORDER,
  getFactorContextPrompt,
  getFactorContextForCategory,
  getCriticalQualityWarning,
  getCriticalQualityWarningForOLQ,
  getFactorConsistencyRules,
  getScoringScaleInstructions,
  getLimitationGuidance,
  getCompleteSSBContext
};
