/**
 * Retry/backoff for Tier-2 evaluation calls (Phase 1, Web SSB Test Flow Parity plan).
 *
 * Port of `shared/.../analysis/RetryBackoffPolicy.kt` + `AnalysisRetry.kt`. The
 * accept/fill-defaults decision stays caller-supplied (`isAcceptable`/`fillDefaults`)
 * rather than hardcoded to the OLQ shape, so `withRetry` itself is reusable if a
 * later phase needs it for a non-OLQ call -- but there is only one caller (`core.js`)
 * today, so it isn't split into a separate "generic" vs "OLQ" file.
 */

const BASE_DELAY_MS = 1000;
const MAX_EXPONENTIAL_DELAY_MS = 8000;
const JITTER_FRACTION = 0.2;
const DEFAULT_MAX_ATTEMPTS = 3;

function exponentialDelayMillis(attempt) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_EXPONENTIAL_DELAY_MS);
}

function jitterRangeMillis(attempt) {
  return exponentialDelayMillis(attempt) * JITTER_FRACTION;
}

/** Lower bound of `nextDelayMillis` for the given attempt -- useful for test assertions. */
function minDelayMillis(attempt) {
  return Math.max(0, exponentialDelayMillis(attempt) - jitterRangeMillis(attempt));
}

/** Upper bound of `nextDelayMillis` for the given attempt -- useful for test assertions. */
function maxDelayMillis(attempt) {
  return exponentialDelayMillis(attempt) + jitterRangeMillis(attempt);
}

/**
 * @param attempt zero-based retry attempt number (0 = delay before the first retry)
 * @param randomFn injectable source of randomness in [0, 1) -- defaults to Math.random
 */
function nextDelayMillis(attempt, randomFn = Math.random) {
  if (attempt < 0) {
    throw new Error(`attempt must be >= 0, was ${attempt}`);
  }
  const jitterRange = jitterRangeMillis(attempt);
  const jitter = jitterRange > 0 ? (randomFn() * 2 - 1) * jitterRange : 0;
  return Math.max(0, Math.round(exponentialDelayMillis(attempt) + jitter));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry loop: calls `call()`, accepts the result if `isAcceptable(result)`
 * is true, otherwise retries (swallowing thrown errors, matching AnalysisRetry.kt's
 * "swallow and retry" behavior) up to `maxAttempts` times with jittered backoff
 * between attempts. Returns `fillDefaults(result)` on acceptance, or `null` once
 * every attempt is exhausted.
 */
async function withRetry({ maxAttempts = DEFAULT_MAX_ATTEMPTS, call, isAcceptable, fillDefaults, delayFn = sleep }) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await call();
      if (isAcceptable(result)) {
        return fillDefaults(result);
      }
    } catch (error) {
      // Swallow and retry -- caller decides how to handle a null return after
      // every attempt is exhausted, matching AnalysisRetry.kt's behavior.
    }
    if (attempt < maxAttempts - 1) {
      await delayFn(nextDelayMillis(attempt));
    }
  }
  return null;
}

module.exports = {
  BASE_DELAY_MS,
  MAX_EXPONENTIAL_DELAY_MS,
  JITTER_FRACTION,
  DEFAULT_MAX_ATTEMPTS,
  nextDelayMillis,
  minDelayMillis,
  maxDelayMillis,
  withRetry
};
