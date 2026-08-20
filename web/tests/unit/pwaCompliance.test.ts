import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PWA Installability & Web App Manifest TDD Suite', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const manifestPath = path.join(publicDir, 'manifest.webmanifest');
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');

  it('should have a physical manifest.webmanifest file in public/', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('should contain all Chrome PWA installability requirements in manifest.webmanifest', () => {
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.name).toBe('SSBMax - Armed Forces Selection Prep');
    expect(manifest.short_name).toBe('SSBMax');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.id).toBe('/');
    expect(manifest.theme_color).toBe('#0f172a');
    expect(manifest.background_color).toBe('#0f172a');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const has192 = manifest.icons.some(
      (icon: { sizes: string; type: string }) => icon.sizes === '192x192' && icon.type === 'image/png'
    );
    const has512 = manifest.icons.some(
      (icon: { sizes: string; type: string }) => icon.sizes === '512x512' && icon.type === 'image/png'
    );
    const hasMaskable = manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose === 'maskable' || icon.purpose === 'any maskable'
    );

    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });

  it('should have all required PWA icon and favicon assets present in public/', () => {
    expect(fs.existsSync(path.join(publicDir, 'pwa-192x192.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'pwa-512x512.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'favicon.ico'))).toBe(true);
  });

  it('should reference manifest and apple touch icons in index.html head', () => {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(htmlContent).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(htmlContent).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(htmlContent).toContain('<meta name="theme-color" content="#0f172a" />');
    expect(htmlContent).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
  });

  it('should configure VitePWA with devOptions enabled in vite.config.ts', () => {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain("registerType: 'autoUpdate'");
    expect(viteConfigContent).toContain('devOptions: {');
    expect(viteConfigContent).toContain('enabled: true');
  });
});
