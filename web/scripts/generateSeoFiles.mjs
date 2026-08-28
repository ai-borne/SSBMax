// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md): writes public/sitemap.xml and
// public/llms.txt from the same contentRoutes.json that react-router reads (src/routes/
// contentRoutes.ts), so a route added there can never leave the sitemap/llms.txt out of
// sync (MEDIUM 11's "sitemap generator stays in sync when a route is added" test gate).
// Runs pre-build/pre-dev alongside generate:content -- output lands in public/ so Vite
// copies it into dist/ untouched (same mechanism as every other static public/ file).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadContentRoutes, buildSitemapXml, buildLlmsTxt } from './seoFiles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const routes = loadContentRoutes();
writeFileSync(join(PUBLIC_DIR, 'sitemap.xml'), buildSitemapXml(routes));
writeFileSync(join(PUBLIC_DIR, 'llms.txt'), buildLlmsTxt(routes));
console.log(`Wrote sitemap.xml and llms.txt for ${routes.length} content route(s).`);
