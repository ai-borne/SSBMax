/**
 * OLQ Definitions & PIQ Mapping Constants
 *
 * Grounding definitions for all 15 Officer-Like Qualities (OLQs) and PIQ mapping logic.
 */

const OLQ_DEFINITIONS = `
OFFICER-LIKE QUALITIES (OLQs) - Definitions & Behavioral Indicators:

INTELLECTUAL QUALITIES (Factor-I):
1. EFFECTIVE_INTELLIGENCE: Practical wisdom, ability to grasp situations quickly and take appropriate action
2. REASONING_ABILITY: Logical thinking, ability to analyze cause-effect relationships
3. ORGANIZING_ABILITY: Systematic planning, resource management, methodical approach
4. POWER_OF_EXPRESSION: Clear articulation, effective communication, vocabulary usage

SOCIAL QUALITIES (Factor-II):
5. SOCIAL_ADJUSTMENT: Adaptability to different social situations, mixing with diverse people
6. COOPERATION: Team player, willingness to help, putting group before self
7. INFLUENCE_GROUP: Natural leadership, ability to convince and motivate others

DYNAMIC QUALITIES (Factor-III):
8. INITIATIVE: Self-starter, proactive action without waiting for instructions
9. SELF_CONFIDENCE: Belief in own abilities, composure under pressure
10. SPEED_OF_DECISION: Quick decision-making without over-analysis
11. DETERMINATION: Persistence, goal-oriented, doesn't give up easily
12. COURAGE: Physical and moral courage, standing up for beliefs

CHARACTER & PHYSICAL QUALITIES (Factor-IV):
13. SENSE_OF_RESPONSIBILITY: Accountability, reliability, duty-consciousness
14. STAMINA: Physical and mental endurance, resilience
15. LIVELINESS: Energy, enthusiasm, positive outlook
`.trim();

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
  PIQ_TO_OLQ_MAPPING
};
