// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md), Regression 1: pure builder for
// the per-route Cloudflare Pages `_headers` block that allows exactly the JSON-LD scripts
// baked into that one prerendered page. Cloudflare replaces (does not merge) a header's
// value when a more specific path also sets it, so a route's block must carry the *entire*
// base CSP, not just an addition -- see scripts/prerenderContentRoutes.mjs for the write path.
import { hashInlineScript, augmentCspScriptSrc, extractCspValue } from './cspHashes.mjs';

/**
 * One Cloudflare `_headers` block for `path`, granting CSP script-src access to exactly the
 * given inline script bodies on top of the base policy. `baseHeadersFileContent` is
 * public/_headers' text (already copied to dist/_headers by Vite) -- reused so this can
 * never drift from the site-wide policy in Regression 1's other directives.
 */
export function buildContentRouteHeaderBlock({ path, jsonLdScripts, baseHeadersFileContent }) {
  const baseCsp = extractCspValue(baseHeadersFileContent);
  const hashes = jsonLdScripts.map(hashInlineScript);
  const augmentedCsp = augmentCspScriptSrc(baseCsp, hashes);
  return `\n${path}\n  Content-Security-Policy: ${augmentedCsp}\n`;
}
