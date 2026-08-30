// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md), Regression 1: index.html's
// Organization/WebSite JSON-LD is static (embedded by hand, not build-generated), so unlike
// the per-route content pages nothing regenerates its CSP hash automatically. This test is
// the guard: if index.html's script content ever changes without public/_headers' hash
// being updated to match, the home page's structured data goes CSP-blocked in every real
// browser while looking fine in a build log -- so this must fail loudly instead.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'path';
import { hashInlineScript } from '../../scripts/cspHashes.mjs';
import { extractCspValue } from '../../scripts/cspHashes.mjs';

const indexHtmlPath = path.resolve(__dirname, '../../index.html');
const headersFilePath = path.resolve(__dirname, '../../public/_headers');

function extractLdJsonScripts(html: string): string[] {
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return matches.map((m) => m[1]);
}

describe('index.html structured data is CSP-hash-allowed', () => {
  const html = readFileSync(indexHtmlPath, 'utf-8');
  const cspValue = extractCspValue(readFileSync(headersFilePath, 'utf-8'));
  const scripts = extractLdJsonScripts(html);

  it('embeds the Organization and WebSite JSON-LD blocks', () => {
    expect(scripts.length).toBe(2);
    const parsed = scripts.map((s) => JSON.parse(s));
    expect(parsed.map((n) => n['@type'])).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
  });

  it('every embedded script hash is present in public/_headers script-src', () => {
    for (const script of scripts) {
      expect(cspValue).toContain(hashInlineScript(script));
    }
  });

  it('does not rely on unsafe-inline to allow these scripts', () => {
    const scriptSrcMatch = cspValue.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
  });
});
