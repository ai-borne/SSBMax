/**
 * TAT prompt builders (Phase 10 Ship, Web SSB Test Flow Parity plan). Verbatim port of
 * `shared/.../ai/prompts/TATStoryAnalysisPrompts.kt::generateTATStoryMultimodalPrompt`
 * (per-story) and `TATSynthesisPrompts.kt::buildPrompt` (cross-story synthesis) -- only
 * the language changed (Kotlin `buildString` -> JS template strings/array joins). The
 * per-story image itself is never part of the prompt string; it is attached as a
 * separate `inlineData` part by `geminiClient.js::generateContent`, mirroring
 * `KtorTATStoryAnalyzer.kt` attaching `imageBytes` alongside the text prompt.
 */

// Murray's 3-tier need taxonomy (R5) -- verbatim port of TATStoryAnalysisPrompts.kt's
// MURRAY_NEEDS_TAXONOMY constant.
const MURRAY_NEEDS_TAXONOMY = `Need tier | Examples                                  | Label
GOOD      | Achievement, Affiliation, Dominance, Order | Positive drive
AVERAGE   | Deference, Exhibition, Understanding       | Neutral/contextual
POOR      | Aggression, Harm-avoidance, Succorance     | Negative/escapist`;

function appendListSection(label, items, prefix = '  - ') {
  if (!items || items.length === 0) return '';
  return `${label}\n${items.map((item) => `${prefix}${item}\n`).join('')}`;
}

function buildPictureBriefing(ctx) {
  let out = '=== PICTURE BRIEFING ===\n';
  if (ctx.sceneDescription) out += `Scene: ${ctx.sceneDescription}\n`;
  out += appendListSection(
    'Core elements (MUST be acknowledged — EFFECTIVE_INTELLIGENCE penalty if missed):',
    ctx.coreElements
  );
  out += appendListSection(
    'Ambiguous elements (creative interpretation acceptable — picture is hazy):',
    ctx.ambiguousElements
  );
  if (ctx.expectedThemes && ctx.expectedThemes.length > 0) {
    out += `Expected story directions: ${ctx.expectedThemes.join(', ')}\n`;
  }
  out += appendListSection('Penalized story themes (heavy penalty):', ctx.penalizedThemes);
  if (ctx.primaryOLQs && ctx.primaryOLQs.length > 0) {
    out += `Primary OLQs this picture tests: ${ctx.primaryOLQs.join(', ')}\n`;
  }
  out += `Deviation tolerance: ${ctx.deviationTolerance || 'MEDIUM'}\n`;
  out += appendListSection('Story elements that score well:', ctx.exemplarGoodHints, '  + ');
  out += appendListSection('Story elements that score poorly:', ctx.exemplarBadHints);
  out += '\n';
  return out;
}

function buildStoryScoringRubric(charactersCount, imageGenderTag) {
  let out = '=== STORY STRUCTURE RUBRIC ===\n';
  out += 'Apply these SSB-specific rules when scoring:\n\n';
  out += 'NEED TAXONOMY (R5 — Murray):\n';
  out += `${MURRAY_NEEDS_TAXONOMY}\n\n`;
  out += 'SCORING RULES (R1–R11):\n';
  out += 'R1  EFFECTIVE_INTELLIGENCE  — Hero must acknowledge all core image elements; each missed element -1\n';
  out += 'R2  ORGANIZING_ABILITY      — Logical 3-act structure (situation→action→resolution); missing act -1\n';
  out += 'R3  POWER_OF_EXPRESSION     — Story < 500 chars: -1 POE; story > 1200 chars with padding: -1 POE\n';
  if (imageGenderTag === 'MIXED') {
    out += 'R4  SELF_CONFIDENCE         — MIXED image: protagonist gender must match candidate gender; mismatch -1 SC\n';
  }
  out += 'R5  REASONING_ABILITY       — Dominant need must be GOOD tier; POOR need as dominant: -1 RA\n';
  out += 'R6  COOPERATION             — At least one support character who aids the hero; absent: -1 COOP\n';
  out += 'R7  SENSE_OF_RESPONSIBILITY — Hero must resolve the central problem; unresolved: -1 SOR\n';
  out += 'R8  INITIATIVE              — Hero must take the first proactive action; reactive-only hero: -1 INI\n';
  out += 'R9  SENSE_OF_RESPONSIBILITY — Hero acting for material reward (money/fame) rather than duty: -1 SOR\n';
  out += 'R10 SPEED_OF_DECISION       — Hero must commit to a decision by mid-story; prolonged indecision: -1 SOD\n';
  out += 'R11 COURAGE                 — At least one adversity or setback in the story; none present: -1 COU\n\n';
  out += 'NOTE: Scores are capped at 9. Multiple rules can stack on the same OLQ.\n';
  out += `Current story length: ${charactersCount} chars\n\n`;
  return out;
}

function buildScoringSection() {
  return `=== EVALUATION CRITERIA — ALL 15 OLQs (MANDATORY) ===
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

=== SSB SCORING SCALE (LOWER IS BETTER) ===
5: Very Good/Excellent (BEST possible score)
6: Good (Above average)
7: Average (Typical performance)
8: Poor (Needs improvement)
9: Fail (Gibberish/Irrelevant/Blank)

=== CRITICAL VALIDATION ===
1. GARBAGE DETECTION: If story is gibberish, random characters, or clearly irrelevant — assign score 9 for ALL OLQs, confidence 100.
2. CONSERVATIVE SCORING: Bias towards lower side. Do NOT be lenient.
3. SCORE RANGE: Use ONLY 5-9. Do NOT assign scores 1-4 or 10.

=== CRITICAL INSTRUCTIONS ===
1. Return ONLY a single JSON object
2. NO markdown code blocks (no backtick markers)
3. ALL 15 OLQs MUST be present
4. Use EXACT enum names shown above
5. Response must START with open-brace and END with close-brace

Each OLQ entry: score (int 5-9), confidence (int 0-100), reasoning (string).
Key: olqScores containing all 15 OLQ keys.
`;
}

/**
 * @param story candidate's submitted story text for this card
 * @param imageContext `TATImageContext`-shaped object -- resolved server-side from the
 *   `test_content/tat/image_batches/{batchId}` doc by `tatEvaluate.js::resolveImageBatch`,
 *   never trusted off the submission doc (SSRF guard, §A of the plan)
 * @param storyIndex zero-based index of this story within the submission
 * @param totalStories total story count in the submission
 * @param imageGenderTag defaults to 'MIXED', matching `TATAnalysisOrchestrator.kt`'s
 *   fallback when the resolved image has no genderTag
 */
function generateTATStoryMultimodalPrompt(
  story,
  imageContext,
  candidateGender = 'Unknown',
  storyIndex = 0,
  totalStories = 1,
  charactersCount = story.length,
  imageGenderTag = 'MIXED'
) {
  let out = `You are an SSB TAT examiner. The candidate viewed the attached picture for 30 seconds then wrote story ${storyIndex + 1} of ${totalStories}.\n\n`;
  out += buildPictureBriefing(imageContext || {});
  out += '=== CANDIDATE STORY ===\n';
  out += `${story}\n`;
  out += `(Length: ${charactersCount} chars)\n\n`;
  out += '=== CANDIDATE PROFILE ===\n';
  out += `Gender: ${candidateGender}\n\n`;
  out += buildStoryScoringRubric(charactersCount, imageGenderTag);
  out += buildScoringSection();
  return out;
}

/**
 * Verbatim port of `TATSynthesisPrompts.kt::buildPrompt`.
 *
 * @param assessments per-story assessment objects `{ storyIndex, story, overallScore,
 *   overallRating, aiConfidence, olqScores: { OLQ_ID: { score, confidence, reasoning } } }`,
 *   the shape `tatEvaluate.js::analyzeStory` produces
 */
function buildTATSynthesisPrompt(assessments) {
  let out = 'You are an SSB psychologist performing final TAT synthesis.\n';
  out += `You have received per-story AI assessments for ${assessments.length} TAT stories.\n`;
  out += 'Your task: synthesise a holistic OLQ profile by detecting patterns across all stories.\n\n';
  out += '=== PER-STORY ASSESSMENTS ===\n';
  const sorted = [...assessments].sort((a, b) => a.storyIndex - b.storyIndex);
  for (const a of sorted) {
    out += '\n';
    out += `--- Story ${a.storyIndex + 1} | score: ${a.overallScore} | rating: ${a.overallRating} | confidence: ${a.aiConfidence}% ---\n`;
    const text = a.story.length > 200 ? `${a.story.slice(0, 200)}...` : a.story;
    out += `Text: ${text}\n`;
    const olqLine = Object.entries(a.olqScores)
      .map(([olqId, s]) => `${olqId}:${s.score}`)
      .join(', ');
    out += `OLQ scores: ${olqLine}\n`;
  }
  out += '\n=== SYNTHESIS TASK ===\n';
  out += '1. PATTERN DETECTION: Which OLQs show consistent strength or weakness across stories?\n';
  out += '2. NARRATIVE EVOLUTION: Does storytelling quality improve or decline across the set?\n';
  out += '3. THEME DOMINANCE: Which recurring themes (positive or negative) appear in multiple stories?\n';
  out += '4. CONTRADICTION DETECTION: Flag inconsistent OLQ patterns (e.g. high Determination in 3 stories, low in 8).\n';
  out += '5. HOLISTIC SCORING: Synthesise a final score for all 15 OLQs that reflects the full picture.\n\n';
  out += '=== SCORING RULES ===\n';
  out += '- Weight later stories slightly more (recency effect).\n';
  out += '- Blank card story carries 1.5× weight in synthesis (§13 — blank card penalises avoidance).\n';
  out += '- Consistent patterns are more reliable than single-story outliers.\n';
  out += '- A single exceptional story cannot compensate for a generally poor performance.\n';
  out += '- Use SSB scale: 5=Very Good (best), 6=Good, 7=Average, 8=Poor, 9=Fail.\n\n';
  out += '=== OLQ CORRELATION CONSTRAINTS ===\n';
  out += '- EI score generally ≥ RA score; Effective Intelligence anchors Reasoning Ability.\n';
  out += '- Factor III (INI/SC/SOD/AIG/LIV) average ≤ Factor I (EI/RA/OA/POE) average.\n';
  out += '- SC anchors INI, SOD, AIG — large divergence between SC and these OLQs is implausible.\n\n';
  out += '=== REJECTION FLAG ===\n';
  out += '- If ANY synthesised OLQ score is ≥ 8 (Poor), set notRecommended: true.\n';
  out += '- A single score of 8 indicates a character flaw too significant to overlook.\n\n';
  out += '=== ALL 15 OLQs (mandatory) ===\n';
  out += 'EFFECTIVE_INTELLIGENCE, REASONING_ABILITY, ORGANIZING_ABILITY, POWER_OF_EXPRESSION, ' +
    'SOCIAL_ADJUSTMENT, COOPERATION, SENSE_OF_RESPONSIBILITY, INITIATIVE, SELF_CONFIDENCE, ' +
    'SPEED_OF_DECISION, INFLUENCE_GROUP, LIVELINESS, DETERMINATION, COURAGE, STAMINA\n\n';
  out += '=== CRITICAL INSTRUCTIONS ===\n';
  out += '1. Return ONLY a single JSON object — NO arrays, NO markdown, NO extra text.\n';
  out += '2. olqScores is a JSON OBJECT keyed by OLQ name (not an array).\n';
  out += '3. ALL 15 OLQs MUST appear as keys inside olqScores.\n';
  out += '4. Each value: { "score": int 5-9, "confidence": int 0-100, "reasoning": string }.\n';
  out += '5. overallConfidence (int 0-100) and notRecommended (bool) at the top level.\n';
  out += '6. Response MUST start with { and end with }.\n\n';
  out += '=== EXACT FORMAT (copy this structure) ===\n';
  out += '{"notRecommended":false,"olqScores":{"EFFECTIVE_INTELLIGENCE":{"score":7,"confidence":80,"reasoning":"..."},' +
    '"REASONING_ABILITY":{"score":6,"confidence":75,"reasoning":"..."},' +
    '"... all 15 OLQs ..."},"overallConfidence":78}';
  return out;
}

module.exports = {
  generateTATStoryMultimodalPrompt,
  buildTATSynthesisPrompt
};
