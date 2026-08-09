import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1: Edge & Network Security Headers & RFC 9116 Security Policy', () => {
  const headersFilePath = path.resolve(__dirname, '../../public/_headers');
  const securityTxtFilePath = path.resolve(__dirname, '../../public/.well-known/security.txt');

  it('should have a valid public/_headers file', () => {
    expect(fs.existsSync(headersFilePath)).toBe(true);
    const content = fs.readFileSync(headersFilePath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('should enforce critical HTTP security headers in _headers', () => {
    const content = fs.readFileSync(headersFilePath, 'utf-8');
    expect(content).toContain('X-Frame-Options: DENY');
    expect(content).toContain('X-Content-Type-Options: nosniff');
    expect(content).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
    expect(content).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    expect(content).toContain('X-Permitted-Cross-Domain-Policies: none');
    expect(content).toContain('Cross-Origin-Opener-Policy: same-origin-allow-popups');
    expect(content).toContain('Cross-Origin-Resource-Policy: cross-origin');
  });

  it('should enforce strict Content-Security-Policy rules without unsafe-inline script tags', () => {
    const content = fs.readFileSync(headersFilePath, 'utf-8');
    expect(content).toContain('Content-Security-Policy:');
    expect(content).toContain("frame-ancestors 'none'");
    expect(content).toContain("object-src 'none'");
    expect(content).toContain("upgrade-insecure-requests");
    
    const cspMatch = content.match(/Content-Security-Policy:\s*(.*)/);
    expect(cspMatch).not.toBeNull();
    if (cspMatch) {
      const cspDirectives = cspMatch[1];
      const scriptSrcMatch = cspDirectives.match(/script-src\s+([^;]+)/);
      expect(scriptSrcMatch).not.toBeNull();
      if (scriptSrcMatch) {
        expect(scriptSrcMatch[1]).not.toContain("'unsafe-inline'");
      }
    }
  });

  it('should provide an RFC 9116 compliant security.txt file', () => {
    expect(fs.existsSync(securityTxtFilePath)).toBe(true);
    const content = fs.readFileSync(securityTxtFilePath, 'utf-8');
    expect(content).toContain('Contact: mailto:security@ssbmax.in');
    expect(content).toContain('Expires:');
    expect(content).toContain('Canonical: https://ssbmax.in/.well-known/security.txt');
    expect(content).toContain('Policy: https://ssbmax.in/privacy');
  });
});
