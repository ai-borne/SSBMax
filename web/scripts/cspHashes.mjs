// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md), Regression 1: JSON-LD must ship
// as inline <script type="application/ld+json"> to be read by crawlers/Rich Results Test,
// but public/_headers' CSP has no 'unsafe-inline' in script-src (enforced by
// tests/security/headers.test.ts) and must stay that way. The fix picked in the plan is
// exact-content sha256 hashes: CSP allows a *specific* script body, not inline scripts in
// general, so this stays strictly narrower than 'unsafe-inline' rather than being a
// loosening of it.
import { createHash } from 'node:crypto';

/** CSP source-expression hash for one exact inline script body (e.g. `sha256-abc123...=`). */
export function hashInlineScript(scriptContent) {
  const digest = createHash('sha256').update(scriptContent, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * Appends CSP hash source-expressions to the `script-src` directive of a full
 * Content-Security-Policy header value, leaving every other directive untouched.
 * Throws if the input has no `script-src` directive -- silently no-op-ing would ship a
 * page whose inline JSON-LD is CSP-blocked at runtime, which is worse than a loud build
 * failure.
 */
export function augmentCspScriptSrc(cspHeaderValue, hashes) {
  if (hashes.length === 0) return cspHeaderValue;
  const directives = cspHeaderValue.split(';').map((d) => d.trim()).filter(Boolean);
  const index = directives.findIndex((d) => d === 'script-src' || d.startsWith('script-src '));
  if (index === -1) {
    throw new Error('augmentCspScriptSrc: no script-src directive found in the given CSP header value');
  }
  directives[index] = `${directives[index]} ${hashes.join(' ')}`;
  return `${directives.join('; ')};`;
}

/** Extracts the `Content-Security-Policy: <value>` line's value from a Cloudflare Pages `_headers`-format block. */
export function extractCspValue(headersFileContent) {
  const match = headersFileContent.match(/Content-Security-Policy:\s*(.+)/);
  if (!match) {
    throw new Error('extractCspValue: no Content-Security-Policy line found');
  }
  return match[1].trim();
}
