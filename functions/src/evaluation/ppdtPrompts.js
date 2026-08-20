/**
 * PPDT prompt builder (Phase 9 Ship, Web SSB Test Flow Parity plan). Port of
 * `shared/.../ai/prompts/PPDTPrompts.kt::generatePPDTMultimodalPrompt`, verbatim
 * text -- only the language changed (Kotlin `buildString` -> JS template
 * strings). The image itself is never part of this string; it is attached as a
 * separate `inlineData` part by `geminiClient.js::generateContent`, mirroring
 * `KtorPPDTAnalyzer.kt` attaching `imageBytes` alongside the text prompt.
 */

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
 * @param story candidate's submitted story text
 * @param imageContext `PPDTImageContext`-shaped object (§ppdtEvaluate.js's `resolveImage`
 *   resolves this server-side from Firestore -- never trusted off the submission doc)
 * @param candidateGender defaults to 'Unknown', matching `PPDTAnalysisOrchestrator.kt`'s
 *   fallback when the user profile lookup fails/is skipped
 */
function generatePPDTMultimodalPrompt(story, imageContext, candidateGender = 'Unknown', writingTimeMinutes = 4) {
  const charactersCount = story.length;
  let out = 'You are an SSB PPDT examiner. The candidate viewed the attached picture for 30 seconds (shown hazy and low-resolution) then wrote the story below.\n\n';
  out += buildPictureBriefing(imageContext || {});
  out += '=== CANDIDATE STORY ===\n';
  out += `${story}\n`;
  out += `(Length: ${charactersCount} chars | Writing time: ${writingTimeMinutes} min)\n\n`;
  out += '=== CANDIDATE PROFILE ===\n';
  out += `Gender: ${candidateGender}\n\n`;
  out += buildScoringSection();
  return out;
}

module.exports = {
  generatePPDTMultimodalPrompt
};
