/**
 * GTO (Group Testing Officer) analysis prompts (Phase 8, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../ai/prompts/GTOAnalysisPrompts.kt` -- **GD/GPE/Lecturette only**.
 *
 * Scope correction made during Phase 8 (not in the original plan text, which named 7
 * sub-types): `GitLiveGTOSubmissionDelegate.kt::parseGtoSubmissionTestType` only ever
 * recognizes GD/GPE/Lecturette -- PGT/HGT/GOR/CT (and IO) can never be read back from
 * Firestore (`toDomain()` throws first), and none of them have a capture UI/ViewModel
 * anywhere in `shared/ui/gto` or `shared/presentation`. Porting prompts for submission
 * shapes that can never actually reach this function would be dead code with no way to
 * test it against a real submission. Confirmed with the user before implementing --
 * PGT/HGT/GOR/CT stay tracked as pre-existing tech debt (dead Firestore mapping +
 * missing capture UI), not addressed in this phase.
 *
 * `escapeXml` (reused from `aiAnalysis.js`) wraps every free-text field -- same
 * prompt-injection defense already applied in `watPrompts.js`/`srtPrompts.js`/`sdPrompts.js`.
 */

const { escapeXml } = require('../aiAnalysis');

const OLQ_EVALUATION_CRITERIA_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
EVALUATION CRITERIA - ALL 15 OLQs (MANDATORY):
═══════════════════════════════════════════════════════════════════════════════

1. EFFECTIVE_INTELLIGENCE: Clarity, logic, analytical thinking
2. REASONING_ABILITY: Problem-solving approach
3. ORGANIZING_ABILITY: Structure, planning, resource allocation
4. POWER_OF_EXPRESSION: Articulation, communication clarity
5. SOCIAL_ADJUSTMENT: Respect for diverse views, team consideration
6. COOPERATION: Collaborative tone
7. SENSE_OF_RESPONSIBILITY: Accountability
8. INITIATIVE: Leadership potential, proactive thinking
9. SELF_CONFIDENCE: Conviction, decisiveness in choices
10. SPEED_OF_DECISION: Decisiveness
11. INFLUENCE_GROUP: Persuasiveness, leadership approach
12. LIVELINESS: Energy and enthusiasm
13. DETERMINATION: Firmness in viewpoint/execution
14. COURAGE: Willingness to take bold/calculated risks
15. STAMINA: Sustained quality throughout
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

const CRITICAL_VALIDATION_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL VALIDATION (MUST CHECK FIRST):
═══════════════════════════════════════════════════════════════════════════════

1. **GARBAGE DETECTION**: If response is gibberish, random characters, or clearly irrelevant
   → Assign score 9 for ALL OLQs, confidence 100, reasoning: "Response appears to be gibberish or irrelevant"

2. **LENGTH CHECK**: If response is significantly shorter than expected → Score 8-9

3. **CONSERVATIVE SCORING**: Bias towards the lower side (worse scores). Do NOT be lenient.

4. **SCORE RANGE**: Use ONLY 5-9. Do NOT assign scores 1-4 or 10.
`.trim();

const CRITICAL_INSTRUCTIONS_SECTION = `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS - READ CAREFULLY:
═══════════════════════════════════════════════════════════════════════════════

1. Return ONLY a single JSON object
2. NO markdown code blocks (no \`\`\`json or \`\`\` markers)
3. NO explanatory text before or after the JSON
4. ALL 15 OLQs MUST be present (failure to include all 15 will cause analysis to fail)
5. Use EXACT enum names: EFFECTIVE_INTELLIGENCE, REASONING_ABILITY, etc.
6. Your entire response should START with { and END with }
7. Each OLQ must have: score (integer 1-10), confidence (integer 0-100), reasoning (string)
`.trim();

function outputFormatSection(sample) {
  return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (Your response must match this EXACTLY):
═══════════════════════════════════════════════════════════════════════════════

{
  "olqScores": ${JSON.stringify(sample, null, 2)}
}
`.trim();
}

const GD_SAMPLE = {
  EFFECTIVE_INTELLIGENCE: { score: 5, confidence: 80, reasoning: 'Clear analytical thinking demonstrated' },
  REASONING_ABILITY: { score: 6, confidence: 75, reasoning: 'Logical arguments presented' },
  ORGANIZING_ABILITY: { score: 6, confidence: 75, reasoning: 'Well-structured response' },
  POWER_OF_EXPRESSION: { score: 5, confidence: 85, reasoning: 'Excellent articulation' },
  SOCIAL_ADJUSTMENT: { score: 7, confidence: 70, reasoning: 'Adequate respect for diverse views' },
  COOPERATION: { score: 6, confidence: 75, reasoning: 'Collaborative tone evident' },
  SENSE_OF_RESPONSIBILITY: { score: 6, confidence: 80, reasoning: 'Accountable in arguments' },
  INITIATIVE: { score: 5, confidence: 85, reasoning: 'Strong leadership potential' },
  SELF_CONFIDENCE: { score: 6, confidence: 80, reasoning: 'Conviction in opinions shown' },
  SPEED_OF_DECISION: { score: 6, confidence: 75, reasoning: 'Decisive stance taken' },
  INFLUENCE_GROUP: { score: 6, confidence: 70, reasoning: 'Persuasive approach' },
  LIVELINESS: { score: 7, confidence: 65, reasoning: 'Moderate energy level' },
  DETERMINATION: { score: 6, confidence: 80, reasoning: 'Firm viewpoint maintained' },
  COURAGE: { score: 6, confidence: 75, reasoning: 'Willing to take bold positions' },
  STAMINA: { score: 6, confidence: 80, reasoning: 'Sustained quality throughout' }
};

/**
 * @param submission raw `submissions/{id}` Firestore doc data (the `SubmissionDocDto`
 *   envelope) -- fields live at `submission.data.*`, matching `GDSubmissionDataDto`'s
 *   wire shape (`GitLiveGTOSubmissionRepository.kt::submitGD`).
 */
function buildGDPrompt(submission) {
  const data = submission.data || {};
  return `
You are analyzing a Group Discussion response for SSB GTO assessment.

═══════════════════════════════════════════════════════════════════════════════
GD SUBMISSION DATA:
═══════════════════════════════════════════════════════════════════════════════

Topic: ${escapeXml(data.topic)}

Candidate Response:
${escapeXml(data.response)}

Character Count: ${data.charCount ?? 0}
Time Spent: ${data.timeSpent ?? 0} seconds

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${CRITICAL_VALIDATION_SECTION}

${CRITICAL_INSTRUCTIONS_SECTION}

${outputFormatSection(GD_SAMPLE)}
`.trim();
}

const GPE_SAMPLE = {
  EFFECTIVE_INTELLIGENCE: { score: 5, confidence: 85, reasoning: 'Clear tactical analysis, identified key challenges' },
  REASONING_ABILITY: { score: 6, confidence: 80, reasoning: 'Logical sequence of actions' },
  ORGANIZING_ABILITY: { score: 5, confidence: 90, reasoning: 'Excellent resource allocation and team coordination' },
  POWER_OF_EXPRESSION: { score: 6, confidence: 75, reasoning: 'Clear communication of plan' },
  SOCIAL_ADJUSTMENT: { score: 7, confidence: 70, reasoning: 'Adequate team consideration' },
  COOPERATION: { score: 6, confidence: 75, reasoning: 'Collaborative approach evident' },
  SENSE_OF_RESPONSIBILITY: { score: 5, confidence: 85, reasoning: 'Strong accountability for mission' },
  INITIATIVE: { score: 5, confidence: 90, reasoning: 'Proactive leadership demonstrated' },
  SELF_CONFIDENCE: { score: 6, confidence: 80, reasoning: 'Decisive choices made' },
  SPEED_OF_DECISION: { score: 6, confidence: 75, reasoning: 'Quick tactical assessment' },
  INFLUENCE_GROUP: { score: 6, confidence: 70, reasoning: 'Leadership approach shown' },
  LIVELINESS: { score: 7, confidence: 65, reasoning: 'Creative solutions proposed' },
  DETERMINATION: { score: 6, confidence: 80, reasoning: 'Firm execution plan' },
  COURAGE: { score: 6, confidence: 75, reasoning: 'Calculated risks considered' },
  STAMINA: { score: 6, confidence: 80, reasoning: 'Thorough throughout the plan' }
};

/**
 * @param submission raw `submissions/{id}` Firestore doc data -- fields live at
 *   `submission.data.*`, matching `GPESubmissionDataDto`'s wire shape. `imageUrl` is
 *   intentionally never sent to Gemini or fetched here (SSRF guard, §A of the plan) --
 *   GPE's evaluation is text-only (scenario/plan), same inputs the KMP orchestrator
 *   actually scores on.
 */
function buildGPEPrompt(submission) {
  const data = submission.data || {};
  const solutionSection = data.solution ? `\n\nIdeal/Suggested Scenario Solution:\n${escapeXml(data.solution)}` : '';

  return `
You are analyzing a Group Planning Exercise (GPE) response for SSB GTO assessment.

═══════════════════════════════════════════════════════════════════════════════
GPE SUBMISSION DATA:
═══════════════════════════════════════════════════════════════════════════════

Scenario: ${escapeXml(data.scenario)}${solutionSection}

Candidate's Tactical Plan:
${escapeXml(data.plan)}

Character Count: ${data.characterCount ?? 0}
Time Spent: ${data.timeSpent ?? 0} seconds

═══════════════════════════════════════════════════════════════════════════════
GPE ASSESSMENT FOCUS:
═══════════════════════════════════════════════════════════════════════════════

The Group Planning Exercise tests a candidate's ability to:
1. Analyze a tactical military scenario
2. Develop a practical action plan
3. Allocate resources effectively
4. Demonstrate leadership qualities
5. Consider contingencies and risks

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${CRITICAL_VALIDATION_SECTION}

═══════════════════════════════════════════════════════════════════════════════
EVALUATION CHECKLIST:
═══════════════════════════════════════════════════════════════════════════════

- Does the plan address the tactical scenario comprehensively?
- Are resources (personnel, equipment, time) allocated effectively?
- Does the plan show leadership and initiative?
- Is there consideration of contingencies and risks?
- Is the plan practical and achievable?
- Compare against the Ideal Solution provided (if any) for accuracy

${CRITICAL_INSTRUCTIONS_SECTION}

${outputFormatSection(GPE_SAMPLE)}
`.trim();
}

const LECTURETTE_SAMPLE = {
  EFFECTIVE_INTELLIGENCE: { score: 5, confidence: 85, reasoning: 'Clear understanding and analytical insights on topic' },
  REASONING_ABILITY: { score: 6, confidence: 80, reasoning: 'Logical flow with coherent arguments' },
  ORGANIZING_ABILITY: { score: 6, confidence: 75, reasoning: 'Well-structured speech with good time management' },
  POWER_OF_EXPRESSION: { score: 5, confidence: 90, reasoning: 'Excellent fluency, articulation, and communication' },
  SOCIAL_ADJUSTMENT: { score: 7, confidence: 70, reasoning: 'Good audience awareness' },
  COOPERATION: { score: 7, confidence: 65, reasoning: 'Collaborative tone in delivery' },
  SENSE_OF_RESPONSIBILITY: { score: 6, confidence: 75, reasoning: 'Accountable statements with ownership' },
  INITIATIVE: { score: 6, confidence: 80, reasoning: 'Good topic choice with original insights' },
  SELF_CONFIDENCE: { score: 5, confidence: 85, reasoning: 'Strong conviction and poise throughout' },
  SPEED_OF_DECISION: { score: 6, confidence: 75, reasoning: 'Quick topic selection and thinking' },
  INFLUENCE_GROUP: { score: 5, confidence: 90, reasoning: 'Highly persuasive and engaging delivery' },
  LIVELINESS: { score: 5, confidence: 85, reasoning: 'Dynamic energy and enthusiasm evident' },
  DETERMINATION: { score: 6, confidence: 80, reasoning: 'Firm viewpoint maintained' },
  COURAGE: { score: 6, confidence: 75, reasoning: 'Expressed bold views confidently' },
  STAMINA: { score: 6, confidence: 80, reasoning: 'Sustained quality throughout 3 minutes' }
};

/**
 * @param submission raw `submissions/{id}` Firestore doc data -- fields live at
 *   `submission.data.*`, matching `LecturetteSubmissionDataDto`'s wire shape.
 */
function buildLecturettePrompt(submission) {
  const data = submission.data || {};
  const topicChoices = data.topicChoices || [];

  return `
You are analyzing a Lecturette (3-minute speech) for SSB GTO assessment.

═══════════════════════════════════════════════════════════════════════════════
LECTURETTE SUBMISSION DATA:
═══════════════════════════════════════════════════════════════════════════════

Topic Chosen: ${escapeXml(data.selectedTopic)}
Available Topics: ${topicChoices.map(escapeXml).join(', ')}

Speech Transcript:
${escapeXml(data.speechTranscript)}

Character Count: ${data.charCount ?? 0}
Time Spent: ${data.timeSpent ?? 0} seconds

═══════════════════════════════════════════════════════════════════════════════
LECTURETTE ASSESSMENT FOCUS:
═══════════════════════════════════════════════════════════════════════════════

A Lecturette tests a candidate's ability to:
1. Speak coherently on a chosen topic for 3 minutes
2. Demonstrate subject knowledge and quick thinking
3. Communicate effectively with confidence
4. Engage and persuade the group
5. Display leadership qualities through verbal communication

${OLQ_EVALUATION_CRITERIA_SECTION}

${SSB_SCORING_SCALE_SECTION}

${CRITICAL_VALIDATION_SECTION}

${CRITICAL_INSTRUCTIONS_SECTION}

${outputFormatSection(LECTURETTE_SAMPLE)}
`.trim();
}

module.exports = {
  buildGDPrompt,
  buildGPEPrompt,
  buildLecturettePrompt
};
