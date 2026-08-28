// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md), Regression 1: Cloudflare Pages
// replaces (does not merge) a header's value when a more specific path also declares it, so
// a per-route block must carry the *entire* base policy plus its own hashes -- a block that
// only added the new hash would silently strip every other CSP directive off that one route.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildContentRouteHeaderBlock } from '../../../scripts/cspHeaders.mjs';
import { hashInlineScript } from '../../../scripts/cspHashes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseHeadersFileContent = readFileSync(join(__dirname, '..', '..', '..', 'public', '_headers'), 'utf8');

describe('buildContentRouteHeaderBlock', () => {
  it('targets the given path and carries the base policy plus a hash per script', () => {
    const jsonLdScripts = ['{"a":1}', '{"b":2}'];
    const block = buildContentRouteHeaderBlock({ path: '/study/ssb-oir-test-preparation', jsonLdScripts, baseHeadersFileContent });

    expect(block).toContain('/study/ssb-oir-test-preparation');
    expect(block).toContain('Content-Security-Policy:');
    expect(block).toContain(hashInlineScript('{"a":1}'));
    expect(block).toContain(hashInlineScript('{"b":2}'));
    // Every other base directive must survive untouched on this route.
    expect(block).toContain("frame-ancestors 'none'");
    expect(block).toContain("object-src 'none'");
  });

  it('never introduces unsafe-inline while granting the hash allowance', () => {
    const block = buildContentRouteHeaderBlock({
      path: '/study/ssb-oir-test-preparation',
      jsonLdScripts: ['{"a":1}'],
      baseHeadersFileContent,
    });
    const scriptSrcMatch = block.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
  });
});
