// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md), Regression 1: the CSP
// hash-allowance mechanism must (a) produce a stable, correct hash for exact bytes, so it
// keeps matching what's embedded in HTML, and (b) refuse to silently no-op when there's no
// script-src to extend, since a page whose JSON-LD isn't actually allowed by CSP would look
// fine in a build log and be silently broken for every real visitor.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { hashInlineScript, augmentCspScriptSrc, extractCspValue } from '../../../scripts/cspHashes.mjs';

describe('hashInlineScript', () => {
  it('matches a manually computed sha256/base64 digest of the exact content', () => {
    const content = '{"@type":"Organization"}';
    const expected = `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
    expect(hashInlineScript(content)).toBe(expected);
  });

  it('is sensitive to a single-character change (proves it hashes exact bytes, not a loose match)', () => {
    expect(hashInlineScript('{"a":1}')).not.toBe(hashInlineScript('{"a":2}'));
  });
});

describe('augmentCspScriptSrc', () => {
  const baseCsp = "default-src 'self'; script-src 'self' https://apis.google.com; object-src 'none';";

  it('appends hashes to script-src only, leaving every other directive untouched', () => {
    const result = augmentCspScriptSrc(baseCsp, ["'sha256-abc='"]);
    expect(result).toContain("script-src 'self' https://apis.google.com 'sha256-abc='");
    expect(result).toContain("default-src 'self'");
    expect(result).toContain("object-src 'none'");
  });

  it('returns the input unchanged when there are no hashes to add', () => {
    expect(augmentCspScriptSrc(baseCsp, [])).toBe(baseCsp);
  });

  it('throws rather than silently no-op-ing when script-src is missing', () => {
    expect(() => augmentCspScriptSrc("default-src 'self';", ["'sha256-abc='"])).toThrow(/script-src/);
  });
});

describe('extractCspValue', () => {
  it('pulls the CSP value out of a Cloudflare _headers-format block', () => {
    const headersFile = "/*\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self';\n";
    expect(extractCspValue(headersFile)).toBe("default-src 'self';");
  });

  it('throws when no Content-Security-Policy line is present', () => {
    expect(() => extractCspValue('/*\n  X-Frame-Options: DENY\n')).toThrow(/Content-Security-Policy/);
  });
});
