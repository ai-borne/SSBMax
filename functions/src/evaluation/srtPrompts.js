/**
 * SRT (Situation Reaction Test) analysis prompt (Phase 5, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../ai/prompts/PsychologyTestPrompts.kt`'s `generateSRTAnalysisPrompt`
 * (SRT-specific sections only -- the shared OLQ/scoring-scale/critical-validation
 * boilerplate below is copied verbatim from that file, same as `watPrompts.js`).
 *
 * `escapeXml` (reused from `aiAnalysis.js`) wraps each situation/response pair --
 * this is untrusted user text flowing into a Gemini prompt, same prompt-injection
 * defense already applied in `watPrompts.js`.
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
    "EFFECTIVE_INTELLIGENCE": {"score": 6, "confidence": 80, "reasoning": "Practical solutions"},
    "REASONING_ABILITY": {"score": 6, "confidence": 75, "reasoning": "Logical approach"},
    "ORGANIZING_ABILITY": {"score": 6, "confidence": 75, "reasoning": "Planning evident"},
    "POWER_OF_EXPRESSION": {"score": 7, "confidence": 70, "reasoning": "Clear communication"},
    "SOCIAL_ADJUSTMENT": {"score": 6, "confidence": 75, "reasoning": "Flexible responses"},
    "COOPERATION": {"score": 5, "confidence": 85, "reasoning": "Team solutions"},
    "SENSE_OF_RESPONSIBILITY": {"score": 5, "confidence": 85, "reasoning": "Takes ownership"},
    "INITIATIVE": {"score": 5, "confidence": 90, "reasoning": "Proactive actions"},
    "SELF_CONFIDENCE": {"score": 6, "confidence": 80, "reasoning": "Decisive responses"},
    "SPEED_OF_DECISION": {"score": 5, "confidence": 85, "reasoning": "Quick decisions"},
    "INFLUENCE_GROUP": {"score": 6, "confidence": 75, "reasoning": "Leadership shown"},
    "LIVELINESS": {"score": 6, "confidence": 75, "reasoning": "Positive approach"},
    "DETERMINATION": {"score": 5, "confidence": 85, "reasoning": "Persistent effort"},
    "COURAGE": {"score": 5, "confidence": 85, "reasoning": "Stands up for right"},
    "STAMINA": {"score": 6, "confidence": 75, "reasoning": "Sustained quality"}
  }
}
`.trim();

/**
 * @param submission raw `submissions/{id}` Firestore doc data (the `SubmissionDocDto`
 *   envelope) -- responses live at `submission.data.responses`, matching
 *   `SRTDataDto`'s wire shape (`situation`/`response`, no per-item timing in the prompt,
 *   matching `PsychologyTestPrompts.kt::generateSRTAnalysisPrompt`).
 */
function buildSRTPrompt(submission) {
  const responses = (submission.data && submission.data.responses) || [];
  const responsesText = responses
    .slice(0, 60)
    .map((r, index) => `${index + 1}. ${escapeXml(r.situation)}\n   Response: ${escapeXml(r.response)}`)
    .join('\n\n');

  return `
You are analyzing SRT (Situation Reaction Test) responses for SSB assessment.

═══════════════════════════════════════════════════════════════════════════════
SRT RESPONSES (60 situations):
═══════════════════════════════════════════════════════════════════════════════

${responsesText}

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${STANDARD_CRITICAL_VALIDATION_SECTION}

${STANDARD_CRITICAL_INSTRUCTIONS_SECTION}

${OUTPUT_FORMAT_SECTION}
`.trim();
}

module.exports = {
  buildSRTPrompt
};
