/**
 * SD (Self Description Test) analysis prompt (Phase 6, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../ai/prompts/PsychologyTestPrompts.kt`'s `generateSDAnalysisPrompt`
 * (SD-specific sections only -- the shared OLQ/scoring-scale/critical-validation
 * boilerplate below is copied verbatim from that file, same as `srtPrompts.js`).
 *
 * `escapeXml` (reused from `aiAnalysis.js`) wraps each answer -- this is untrusted
 * user text flowing into a Gemini prompt, same prompt-injection defense already
 * applied in `watPrompts.js`/`srtPrompts.js`.
 */

const { escapeXml } = require('../aiAnalysis');

const OLQ_EVALUATION_CRITERIA_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
EVALUATION CRITERIA - ALL 15 OLQs (MANDATORY):
═══════════════════════════════════════════════════════════════════════════════

1. EFFECTIVE_INTELLIGENCE: Practical wisdom, common sense
2. REASONING_ABILITY: Logical thinking, problem-solving
3. ORGANIZING_ABILITY: Planning, systematic approach
4. POWER_OF_EXPRESSION: Communication clarity
5. SOCIAL_ADJUSTMENT: Adaptability, flexibility
6. COOPERATION: Teamwork, helping others
7. SENSE_OF_RESPONSIBILITY: Accountability, reliability
8. INITIATIVE: Proactive action, self-starting
9. SELF_CONFIDENCE: Composure, positive self-image
10. SPEED_OF_DECISION: Quick decision-making
11. INFLUENCE_GROUP: Leadership, persuasion
12. LIVELINESS: Energy, optimism
13. DETERMINATION: Persistence, goal-oriented
14. COURAGE: Facing fears, standing up for beliefs
15. STAMINA: Endurance, resilience
`.trim();

const SSB_SCORING_SCALE_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
SSB SCORING SCALE (UNIFIED - LOWER IS BETTER):
═══════════════════════════════════════════════════════════════════════════════

5: Very Good/Excellent (BEST possible score - rare)
6: Good (Above average)
7: Average (Typical performance)
8: Poor (Needs improvement)
9: Fail (Gibberish/Irrelevant/Blank)
`.trim();

const STANDARD_CRITICAL_VALIDATION_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL VALIDATION (MUST CHECK FIRST):
═══════════════════════════════════════════════════════════════════════════════

1. **GARBAGE DETECTION**: If responses are gibberish, random characters, or clearly irrelevant
   → Assign score 9 for ALL OLQs, confidence 100, reasoning: "Response appears to be gibberish or irrelevant"

2. **CONSERVATIVE SCORING**: Bias towards the lower side (worse scores). Do NOT be lenient.

3. **SCORE RANGE**: Use ONLY 5-9. Do NOT assign scores 1-4 or 10.
`.trim();

const STANDARD_CRITICAL_INSTRUCTIONS_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS:
═══════════════════════════════════════════════════════════════════════════════

1. Return ONLY a single JSON object
2. NO markdown code blocks (no \`\`\`json or \`\`\` markers)
3. NO explanatory text before or after the JSON
4. ALL 15 OLQs MUST be present
5. Use EXACT enum names: EFFECTIVE_INTELLIGENCE, REASONING_ABILITY, etc.
6. Your entire response should START with { and END with }
`.trim();

const OUTPUT_FORMAT_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

{
  "olqScores": {
    "EFFECTIVE_INTELLIGENCE": {"score": 5, "confidence": 85, "reasoning": "Shows self-awareness"},
    "REASONING_ABILITY": {"score": 6, "confidence": 80, "reasoning": "Logical self-view"},
    "ORGANIZING_ABILITY": {"score": 6, "confidence": 75, "reasoning": "Structured responses"},
    "POWER_OF_EXPRESSION": {"score": 6, "confidence": 80, "reasoning": "Clear communication"},
    "SOCIAL_ADJUSTMENT": {"score": 6, "confidence": 75, "reasoning": "Awareness of others"},
    "COOPERATION": {"score": 5, "confidence": 85, "reasoning": "Mentions helping others"},
    "SENSE_OF_RESPONSIBILITY": {"score": 6, "confidence": 80, "reasoning": "Accountable language"},
    "INITIATIVE": {"score": 6, "confidence": 80, "reasoning": "Proactive traits"},
    "SELF_CONFIDENCE": {"score": 5, "confidence": 85, "reasoning": "Optimistic self-view"},
    "SPEED_OF_DECISION": {"score": 6, "confidence": 75, "reasoning": "Decisive language"},
    "INFLUENCE_GROUP": {"score": 6, "confidence": 75, "reasoning": "Leadership mentioned"},
    "LIVELINESS": {"score": 5, "confidence": 85, "reasoning": "Positive outlook"},
    "DETERMINATION": {"score": 5, "confidence": 85, "reasoning": "Goal-oriented language"},
    "COURAGE": {"score": 6, "confidence": 75, "reasoning": "Acknowledges challenges"},
    "STAMINA": {"score": 6, "confidence": 75, "reasoning": "Resilience mentioned"}
  }
}
`.trim();

const PERSPECTIVE_BY_INDEX = ["Parents' Opinion", "Teachers/Seniors' Opinion", "Friends' Opinion", 'Own Opinion'];

/**
 * @param submission raw `submissions/{id}` Firestore doc data (the `SubmissionDocDto`
 *   envelope) -- responses live at `submission.data.responses`, matching
 *   `SDTDataDto`'s wire shape (`answer` field, no `question` text used in the prompt --
 *   the first 4 responses are labeled by fixed perspective order), matching
 *   `PsychologyTestPrompts.kt::generateSDAnalysisPrompt`.
 */
function buildSDPrompt(submission) {
  const responses = (submission.data && submission.data.responses) || [];
  const descriptionsText = responses
    .map((r, index) => {
      const perspective = PERSPECTIVE_BY_INDEX[index] || `Response ${index + 1}`;
      return `${perspective}: ${escapeXml(r.answer)}`;
    })
    .join('\n\n');

  return `
You are analyzing Self Description Test responses for SSB assessment.

═══════════════════════════════════════════════════════════════════════════════
SELF DESCRIPTION RESPONSES:
═══════════════════════════════════════════════════════════════════════════════

${descriptionsText}

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${STANDARD_CRITICAL_VALIDATION_SECTION}

${STANDARD_CRITICAL_INSTRUCTIONS_SECTION}

${OUTPUT_FORMAT_SECTION}
`.trim();
}

module.exports = {
  buildSDPrompt
};
