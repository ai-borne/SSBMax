/**
 * Server-side mirror of `shared/.../domain/model/interview/OLQ.kt`'s 15 Officer Like
 * Qualities and their 4 SSB-factor categories, plus the 27-question emergency fallback
 * list ported from `shared/.../data/repository/InterviewFallbackQuestions.kt`.
 *
 * Kept as plain data (no enum-like class) since this module has no shared codegen path
 * with the Kotlin `OLQ`/`OLQCategory` enums (Tier 1 contracts codegen only covers
 * Firestore paths/limits/tokens, not domain enums like these -- root CLAUDE.md §2).
 * Any change to the Kotlin enums must be mirrored here by hand.
 */

const OLQ_CATEGORY = {
  EFFECTIVE_INTELLIGENCE: 'INTELLECTUAL',
  REASONING_ABILITY: 'INTELLECTUAL',
  ORGANIZING_ABILITY: 'INTELLECTUAL',
  POWER_OF_EXPRESSION: 'INTELLECTUAL',
  SOCIAL_ADJUSTMENT: 'SOCIAL',
  COOPERATION: 'SOCIAL',
  SENSE_OF_RESPONSIBILITY: 'SOCIAL',
  INITIATIVE: 'DYNAMIC',
  SELF_CONFIDENCE: 'DYNAMIC',
  SPEED_OF_DECISION: 'DYNAMIC',
  INFLUENCE_GROUP: 'DYNAMIC',
  LIVELINESS: 'DYNAMIC',
  DETERMINATION: 'CHARACTER',
  COURAGE: 'CHARACTER',
  STAMINA: 'CHARACTER'
};

const OLQ_DISPLAY_NAMES = {
  EFFECTIVE_INTELLIGENCE: 'Effective Intelligence',
  REASONING_ABILITY: 'Reasoning Ability',
  ORGANIZING_ABILITY: 'Organizing Ability',
  POWER_OF_EXPRESSION: 'Power of Expression',
  SOCIAL_ADJUSTMENT: 'Social Adjustment',
  COOPERATION: 'Cooperation',
  SENSE_OF_RESPONSIBILITY: 'Sense of Responsibility',
  INITIATIVE: 'Initiative',
  SELF_CONFIDENCE: 'Self Confidence',
  SPEED_OF_DECISION: 'Speed of Decision',
  INFLUENCE_GROUP: 'Ability to Influence Group',
  LIVELINESS: 'Liveliness',
  DETERMINATION: 'Determination',
  COURAGE: 'Courage',
  STAMINA: 'Stamina'
};

const CATEGORIES = ['INTELLECTUAL', 'SOCIAL', 'DYNAMIC', 'CHARACTER'];

const OLQ_NAMES = new Set(Object.keys(OLQ_CATEGORY));

/** Ported verbatim (text + targeted OLQs) from InterviewFallbackQuestions.kt's 27 entries. */
const FALLBACK_QUESTIONS = [
  { questionText: 'Tell me about yourself and your background.', targetOLQs: ['SELF_CONFIDENCE', 'POWER_OF_EXPRESSION'] },
  { questionText: 'Why do you want to join the armed forces?', targetOLQs: ['DETERMINATION', 'SENSE_OF_RESPONSIBILITY'] },
  { questionText: 'Describe a challenging situation you faced and how you handled it.', targetOLQs: ['REASONING_ABILITY', 'SPEED_OF_DECISION', 'COURAGE'] },
  { questionText: 'What are your strengths and weaknesses?', targetOLQs: ['SELF_CONFIDENCE', 'POWER_OF_EXPRESSION'] },
  { questionText: 'How do you handle working in a team?', targetOLQs: ['COOPERATION', 'SOCIAL_ADJUSTMENT', 'INFLUENCE_GROUP'] },
  { questionText: 'Describe a time when you demonstrated leadership.', targetOLQs: ['ORGANIZING_ABILITY', 'INITIATIVE', 'EFFECTIVE_INTELLIGENCE'] },
  { questionText: 'What are your hobbies and interests?', targetOLQs: ['LIVELINESS', 'SOCIAL_ADJUSTMENT'] },
  { questionText: 'How do you handle stress and pressure?', targetOLQs: ['STAMINA', 'COURAGE', 'SELF_CONFIDENCE'] },
  { questionText: 'What do you know about the role you are applying for?', targetOLQs: ['EFFECTIVE_INTELLIGENCE', 'SENSE_OF_RESPONSIBILITY'] },
  { questionText: 'Where do you see yourself in 5 years?', targetOLQs: ['DETERMINATION', 'ORGANIZING_ABILITY'] },
  { questionText: 'Describe a situation where you had to take initiative without being told.', targetOLQs: ['INITIATIVE', 'SELF_CONFIDENCE', 'DETERMINATION'] },
  { questionText: 'How would you convince a group of people who disagree with your plan?', targetOLQs: ['INFLUENCE_GROUP', 'POWER_OF_EXPRESSION', 'REASONING_ABILITY'] },
  { questionText: 'Tell me about a time when you had to make a quick decision with limited information.', targetOLQs: ['SPEED_OF_DECISION', 'COURAGE', 'EFFECTIVE_INTELLIGENCE'] },
  { questionText: 'How do you organize your day and prioritize tasks?', targetOLQs: ['ORGANIZING_ABILITY', 'EFFECTIVE_INTELLIGENCE'] },
  { questionText: 'Describe a situation where you had to stand up for what you believed was right.', targetOLQs: ['COURAGE', 'DETERMINATION', 'SENSE_OF_RESPONSIBILITY'] },
  { questionText: 'How do you maintain your physical fitness?', targetOLQs: ['STAMINA', 'DETERMINATION', 'LIVELINESS'] },
  { questionText: 'Tell me about a time when you helped someone in need.', targetOLQs: ['COOPERATION', 'SENSE_OF_RESPONSIBILITY', 'SOCIAL_ADJUSTMENT'] },
  { questionText: 'How do you handle criticism or negative feedback?', targetOLQs: ['SELF_CONFIDENCE', 'SOCIAL_ADJUSTMENT', 'REASONING_ABILITY'] },
  { questionText: 'Describe a goal you achieved that required sustained effort over a long period.', targetOLQs: ['DETERMINATION', 'STAMINA', 'ORGANIZING_ABILITY'] },
  { questionText: 'How would you handle a conflict between two team members?', targetOLQs: ['COOPERATION', 'INFLUENCE_GROUP', 'REASONING_ABILITY'] },
  { questionText: 'What current affairs topic interests you the most and why?', targetOLQs: ['EFFECTIVE_INTELLIGENCE', 'POWER_OF_EXPRESSION'] },
  { questionText: 'Describe a time when you failed at something. What did you learn?', targetOLQs: ['SELF_CONFIDENCE', 'REASONING_ABILITY', 'DETERMINATION'] },
  { questionText: 'How do you stay motivated when things get difficult?', targetOLQs: ['DETERMINATION', 'STAMINA', 'SELF_CONFIDENCE'] },
  { questionText: 'Tell me about your family and their influence on you.', targetOLQs: ['SOCIAL_ADJUSTMENT', 'SENSE_OF_RESPONSIBILITY'] },
  { questionText: 'How would you handle a situation where you had to lead people older than you?', targetOLQs: ['INITIATIVE', 'INFLUENCE_GROUP', 'SELF_CONFIDENCE'] },
  { questionText: 'Describe your approach to learning new skills.', targetOLQs: ['EFFECTIVE_INTELLIGENCE', 'INITIATIVE', 'DETERMINATION'] },
  { questionText: 'What would you do if you witnessed a colleague doing something unethical?', targetOLQs: ['COURAGE', 'SENSE_OF_RESPONSIBILITY', 'REASONING_ABILITY'] }
].map((q) => ({ ...q, context: null, source: 'GENERIC_POOL' }));

module.exports = { OLQ_CATEGORY, OLQ_DISPLAY_NAMES, CATEGORIES, OLQ_NAMES, FALLBACK_QUESTIONS };
