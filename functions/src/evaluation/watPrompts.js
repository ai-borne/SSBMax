/**
 * WAT (Word Association Test) analysis prompt (Phase 4, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../ai/prompts/PsychologyTestPrompts.kt`'s `generateWATAnalysisPrompt`
 * (WAT-specific sections only -- the shared OLQ/scoring-scale/critical-validation
 * boilerplate below is copied verbatim from that file rather than re-derived from
 * `olqPrompts.js`'s SSB-factor-structure prompt, which covers a different, longer-form
 * variant not used by this exact prompt).
 *
 * `escapeXml` (reused from `aiAnalysis.js`) wraps each word-association response --
 * this is untrusted user text flowing into a Gemini prompt, same prompt-injection
 * defense already applied to interview responses in `aiAnalysis.js::buildAnalysisPrompt`.
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
    "EFFECTIVE_INTELLIGENCE": {"score": 6, "confidence": 80, "reasoning": "Creative associations shown"},
    "REASONING_ABILITY": {"score": 6, "confidence": 75, "reasoning": "Logical patterns"},
    "ORGANIZING_ABILITY": {"score": 6, "confidence": 75, "reasoning": "Structured thinking"},
    "POWER_OF_EXPRESSION": {"score": 7, "confidence": 70, "reasoning": "Adequate vocabulary"},
    "SOCIAL_ADJUSTMENT": {"score": 6, "confidence": 75, "reasoning": "Social words present"},
    "COOPERATION": {"score": 6, "confidence": 75, "reasoning": "Team-oriented responses"},
    "SENSE_OF_RESPONSIBILITY": {"score": 6, "confidence": 80, "reasoning": "Accountable language"},
    "INITIATIVE": {"score": 6, "confidence": 85, "reasoning": "Action words used"},
    "SELF_CONFIDENCE": {"score": 6, "confidence": 80, "reasoning": "Positive associations"},
    "SPEED_OF_DECISION": {"score": 5, "confidence": 85, "reasoning": "Quick response time"},
    "INFLUENCE_GROUP": {"score": 6, "confidence": 70, "reasoning": "Leadership words"},
    "LIVELINESS": {"score": 5, "confidence": 85, "reasoning": "Optimistic tone"},
    "DETERMINATION": {"score": 6, "confidence": 80, "reasoning": "Persistent themes"},
    "COURAGE": {"score": 6, "confidence": 75, "reasoning": "Bold words used"},
    "STAMINA": {"score": 6, "confidence": 75, "reasoning": "Sustained quality"}
  }
}
`.trim();

function averageResponseTime(responses) {
  if (!responses.length) return 0;
  return responses.reduce((sum, r) => sum + (r.timeTakenSeconds || 0), 0) / responses.length;
}

/**
 * @param submission raw `submissions/{id}` Firestore doc data (the `SubmissionDocDto`
 *   envelope) -- responses live at `submission.data.responses`, matching
 *   `WATDataDto`'s wire shape.
 */
function buildWATPrompt(submission) {
  const responses = (submission.data && submission.data.responses) || [];
  const responsesText = responses
    .slice(0, 60)
    .map((r, index) => `${index + 1}. ${escapeXml(r.word)} → ${escapeXml(r.response)} (${r.timeTakenSeconds}s)`)
    .join('\n');

  return `
You are analyzing WAT (Word Association Test) responses for SSB assessment.

═══════════════════════════════════════════════════════════════════════════════
WAT RESPONSES (60 word associations):
═══════════════════════════════════════════════════════════════════════════════

${responsesText}

Average response time: ${averageResponseTime(responses)}s

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${STANDARD_CRITICAL_VALIDATION_SECTION}

${STANDARD_CRITICAL_INSTRUCTIONS_SECTION}

${OUTPUT_FORMAT_SECTION}
`.trim();
}

module.exports = {
  buildWATPrompt,
  averageResponseTime
};
