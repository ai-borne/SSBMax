/**
 * OLQ Definitions & PIQ Mapping Constants
 *
 * Grounding definitions for all 15 Officer-Like Qualities (OLQs) and PIQ mapping logic.
 *
 * Phase 3 (docs/plans/CrossPlatform_SSOT): the id/category grouping is generated from
 * the contract (contracts/enums.yaml -> generated/contracts.cjs), not redeclared here.
 * Only the behavioral notes are authored -- the completeness test in
 * functions/test/olqDefinitions.test.js fails loudly if a contract OLQ id gains no
 * note, or a note here names an id the contract doesn't have, so the Gemini prompt
 * and the parser (aiAnalysis.js) can never silently disagree on the OLQ set. This
 * also corrects a pre-existing drift: the old hand-written grouping here put
 * COOPERATION/INFLUENCE_GROUP under "Social" and SENSE_OF_RESPONSIBILITY under
 * "Character", which never matched shared/.../domain/model/interview/OLQ.kt's real
 * categories -- KMP is authoritative (root CLAUDE.md), so the generated grouping wins.
 */

const { Enums } = require('./generated/contracts.cjs');

const OLQ_BEHAVIORAL_NOTES = {
  EFFECTIVE_INTELLIGENCE: 'Practical wisdom, ability to grasp situations quickly and take appropriate action',
  REASONING_ABILITY: 'Logical thinking, ability to analyze cause-effect relationships',
  ORGANIZING_ABILITY: 'Systematic planning, resource management, methodical approach',
  POWER_OF_EXPRESSION: 'Clear articulation, effective communication, vocabulary usage',
  SOCIAL_ADJUSTMENT: 'Adaptability to different social situations, mixing with diverse people',
  COOPERATION: 'Team player, willingness to help, putting group before self',
  SENSE_OF_RESPONSIBILITY: 'Accountability, reliability, duty-consciousness',
  INITIATIVE: 'Self-starter, proactive action without waiting for instructions',
  SELF_CONFIDENCE: 'Belief in own abilities, composure under pressure',
  SPEED_OF_DECISION: 'Quick decision-making without over-analysis',
  INFLUENCE_GROUP: 'Natural leadership, ability to convince and motivate others',
  LIVELINESS: 'Energy, enthusiasm, positive outlook',
  DETERMINATION: 'Persistence, goal-oriented, does not give up easily',
  COURAGE: 'Physical and moral courage, standing up for beliefs',
  STAMINA: 'Physical and mental endurance, resilience',
};

const FACTOR_HEADINGS = [
  ['INTELLECTUAL', 'INTELLECTUAL QUALITIES (Factor-I):'],
  ['SOCIAL', 'SOCIAL QUALITIES (Factor-II):'],
  ['DYNAMIC', 'DYNAMIC QUALITIES (Factor-III):'],
  ['CHARACTER', 'CHARACTER & PHYSICAL QUALITIES (Factor-IV):'],
];

function buildOlqDefinitions() {
  const byCategory = {};
  for (const olq of Object.values(Enums.OLQ)) {
    (byCategory[olq.category] = byCategory[olq.category] || []).push(olq);
  }

  let n = 1;
  const sections = FACTOR_HEADINGS.map(([category, heading]) => {
    const lines = (byCategory[category] || []).map((olq) => {
      const note = OLQ_BEHAVIORAL_NOTES[olq.id];
      if (!note) {
        throw new Error(`olqDefinitions: no behavioral note authored for contract OLQ '${olq.id}'`);
      }
      return `${n++}. ${olq.id}: ${note}`;
    });
    return [heading, ...lines].join('\n');
  });

  return `OFFICER-LIKE QUALITIES (OLQs) - Definitions & Behavioral Indicators:\n\n${sections.join('\n\n')}`.trim();
}

const OLQ_DEFINITIONS = buildOlqDefinitions();

const PIQ_TO_OLQ_MAPPING = `
PIQ SECTIONS → OLQ ASSESSMENT MAPPING:
- Rural/Small town → SOCIAL_ADJUSTMENT, STAMINA
- Urban/Metro → POWER_OF_EXPRESSION, INFLUENCE_GROUP
- Defense family → SENSE_OF_RESPONSIBILITY, COURAGE
- Single parent → DETERMINATION, STAMINA
- Boarding school / Team sports → SOCIAL_ADJUSTMENT, COOPERATION
- Work experience → SENSE_OF_RESPONSIBILITY, ORGANIZING_ABILITY
- NCC training → SENSE_OF_RESPONSIBILITY, ORGANIZING_ABILITY, COURAGE
- Repeat attempt → DETERMINATION, learning shown
`.trim();

module.exports = {
  OLQ_DEFINITIONS,
  PIQ_TO_OLQ_MAPPING,
  OLQ_BEHAVIORAL_NOTES,
  buildOlqDefinitions,
};
