/**
 * Gemini evaluation response parsing (Phase 1, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../ai/KtorGeminiResponseParser.kt` -- only the two
 * evaluation-scoring shapes (`parseAnalysisResponse` and
 * `parseGTOAnalysisResponse`, unified here into one `parseEvaluationResponse`
 * since every evaluation caller needs the same OLQ-scores-out shape).
 * `parseQuestionResponse` (interview question generation) isn't evaluation
 * logic and is out of scope for this file.
 */

const { Enums } = require('../generated/contracts.cjs');

const OLQ_IDS = Object.keys(Enums.OLQ);

function findOlqId(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  return (
    OLQ_IDS.find(
      (id) => id.toLowerCase() === lower || Enums.OLQ[id].displayName.toLowerCase() === lower
    ) || null
  );
}

/** Ported verbatim from GeminiResponseParser.extractJsonFromResponse. */
function extractJsonFromResponse(responseText) {
  if (responseText.includes('```json')) {
    return responseText.split('```json')[1].split('```')[0].trim();
  }
  if (responseText.includes('```')) {
    return responseText.split('```')[1].split('```')[0].trim();
  }
  const bracketIndex = responseText.indexOf('[');
  const braceIndex = responseText.indexOf('{');
  if (
    responseText.includes('[') &&
    responseText.includes(']') &&
    bracketIndex < (braceIndex >= 0 ? braceIndex : Number.MAX_SAFE_INTEGER)
  ) {
    const start = bracketIndex;
    const end = responseText.lastIndexOf(']') + 1;
    return responseText.substring(start, end).trim();
  }
  if (responseText.includes('{') && responseText.includes('}')) {
    const start = braceIndex;
    const end = responseText.lastIndexOf('}') + 1;
    return responseText.substring(start, end).trim();
  }
  return responseText.trim();
}

function clampConfidence(value, fallback = 50) {
  const n = Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, n));
}

function averageConfidence(values, fallback = 50) {
  if (!values.length) return fallback;
  return clampConfidence(values.reduce((a, b) => a + (Number.isFinite(b) ? b : fallback), 0) / values.length, fallback);
}

/**
 * Parses the `{olqScores: {OLQ_KEY: {score, confidence, reasoning}}}` shape.
 */
function parseKeyedObjectFormat(cleanJson) {
  const parsed = JSON.parse(cleanJson);
  const entries = Object.entries(parsed.olqScores || {});
  const olqScores = {};
  const confidences = [];
  for (const [olqKey, scoreDto] of entries) {
    const olqId = findOlqId(olqKey);
    if (!olqId) continue;
    olqScores[olqId] = {
      score: scoreDto.score ?? 6,
      confidence: clampConfidence(scoreDto.confidence, 50),
      reasoning: scoreDto.reasoning || ''
    };
    confidences.push(scoreDto.confidence);
  }
  if (Object.keys(olqScores).length === 0) {
    throw new Error('No OLQ scores parsed from response');
  }
  return {
    olqScores,
    overallConfidence: averageConfidence(confidences),
    keyInsights: [],
    suggestedFollowUp: null,
    notRecommended: Boolean(parsed.notRecommended)
  };
}

/**
 * Parses the bare `[{olq, score, confidence, reasoning}, ...]` array shape,
 * and (for `parseAnalysisResponse`-style callers) the `{olqScores: [...]}`
 * object-of-array shape with `evidence`/`overallConfidence`/`keyInsights`.
 */
function parseArrayFormat(items, topLevel = {}) {
  const olqScores = {};
  const confidences = [];
  for (const item of items) {
    const olqId = findOlqId(item.olq);
    if (!olqId) continue;
    olqScores[olqId] = {
      score: item.score ?? 6,
      confidence: clampConfidence(item.confidence, 50),
      reasoning: item.reasoning || ''
    };
    confidences.push(item.confidence);
  }
  if (Object.keys(olqScores).length === 0) {
    throw new Error('No OLQ scores parsed from array response');
  }
  return {
    olqScores,
    overallConfidence: Number.isFinite(topLevel.overallConfidence)
      ? clampConfidence(topLevel.overallConfidence)
      : averageConfidence(confidences),
    keyInsights: topLevel.keyInsights || [],
    suggestedFollowUp: topLevel.suggestedFollowUp || null,
    notRecommended: false
  };
}

/**
 * Unified evaluation-response parser. Handles all three shapes Gemini emits
 * in practice: an `olqScores` array (single-response interview analysis), an
 * `olqScores` keyed-object (GTO/TAT/WAT/SRT/SD/PPDT canonical shape), or a
 * bare array (GTO/TAT/WAT/SRT/SD/PPDT, observed alternate shape).
 */
function parseEvaluationResponse(responseText) {
  if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
    throw new Error('Empty or invalid string response from Gemini');
  }

  const cleanJson = extractJsonFromResponse(responseText);
  const parsed = JSON.parse(cleanJson);

  if (Array.isArray(parsed)) {
    return parseArrayFormat(parsed);
  }
  if (Array.isArray(parsed.olqScores)) {
    return parseArrayFormat(parsed.olqScores, parsed);
  }
  if (parsed.olqScores && typeof parsed.olqScores === 'object') {
    return parseKeyedObjectFormat(cleanJson);
  }
  throw new Error('Invalid response structure from Gemini: missing olqScores');
}

const OLQ_ALL_IDS = Object.keys(Enums.OLQ);
const MIN_ACCEPTABLE_OLQS = 14;
const DEFAULT_SCORE_RANGE = [5, 9];
const FILLED_OLQ_SCORE = 6;
const FILLED_OLQ_CONFIDENCE = 30;
const FILLED_OLQ_REASONING = 'AI did not assess this OLQ - neutral score assigned';

function clampScore(score, range = DEFAULT_SCORE_RANGE) {
  const [min, max] = range;
  const n = Number.isFinite(score) ? Math.trunc(score) : min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Port of `AnalysisRetry.kt`'s clamp/accept/fill-missing gate -- the piece of KMP's
 * per-OLQ-score shaping that lived in the orchestrator's retry loop, not in
 * `KtorGeminiResponseParser`, so it wasn't ported alongside `parseEvaluationResponse`
 * in Phase 1. Takes `parseEvaluationResponse`'s output and either returns a
 * fully-shaped 15-OLQ score map (accepted) or `null` (reject -> `core.js`'s
 * `withRetry` tries again), exactly mirroring `AnalysisRetry.withRetry`'s
 * `MIN_ACCEPTABLE_OLQS = 14` threshold, per-score clamp to `scoreRange` (default
 * 5..9, the SSB scale), and neutral-fill (score 6, confidence 30) for any OLQ
 * missing from a 14-of-15 response.
 */
function finalizeOlqScores(parsed, scoreRange = DEFAULT_SCORE_RANGE) {
  const rawIds = Object.keys(parsed.olqScores || {}).filter((id) => OLQ_ALL_IDS.includes(id));
  if (rawIds.length < MIN_ACCEPTABLE_OLQS) {
    return null;
  }

  const olqScores = {};
  for (const olqId of rawIds) {
    const scoreDto = parsed.olqScores[olqId];
    olqScores[olqId] = {
      score: clampScore(scoreDto.score, scoreRange),
      confidence: parsed.overallConfidence,
      reasoning: scoreDto.reasoning || ''
    };
  }
  for (const olqId of OLQ_ALL_IDS) {
    if (!olqScores[olqId]) {
      olqScores[olqId] = { score: FILLED_OLQ_SCORE, confidence: FILLED_OLQ_CONFIDENCE, reasoning: FILLED_OLQ_REASONING };
    }
  }

  return {
    olqScores,
    overallConfidence: parsed.overallConfidence,
    keyInsights: parsed.keyInsights || [],
    suggestedFollowUp: parsed.suggestedFollowUp || null,
    notRecommended: Boolean(parsed.notRecommended)
  };
}

/** Port of `AnalysisRetry.ratingFromScore` -- maps an averaged overall OLQ score to a label. */
function ratingFromScore(score) {
  if (score <= 5.5) return 'Exceptional';
  if (score <= 6.5) return 'Good';
  if (score <= 7.5) return 'Average';
  return 'Needs Improvement';
}

module.exports = {
  extractJsonFromResponse,
  parseEvaluationResponse,
  finalizeOlqScores,
  clampScore,
  ratingFromScore,
  MIN_ACCEPTABLE_OLQS,
  DEFAULT_SCORE_RANGE
};
