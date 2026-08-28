// Pure functions behind scripts/generateSeoFiles.mjs, split out so tests can import them
// without triggering the write-to-public/ side effect (mirrors loadContent.mjs vs.
// generateContentBundle.mjs's split). See generateSeoFiles.mjs for the write path.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = join(__dirname, '..', 'src', 'routes', 'contentRoutes.json');

// Kept in sync manually with src/routes/contentRoutes.ts's SITE_BASE_URL -- see that
// file's comment. A plain Node script can't import the .ts module.
export const SITE_BASE_URL = 'https://ssbmax.in';

export function loadContentRoutes() {
  return JSON.parse(readFileSync(ROUTES_PATH, 'utf8'));
}

/** '/' plus every permanent content path, each as an absolute https://ssbmax.in/... URL. */
export function buildSitemapXml(routes, baseUrl = SITE_BASE_URL) {
  const urls = [baseUrl, ...routes.map((r) => `${baseUrl}${r.path}`)];
  const entries = urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/** llms.txt per the llmstxt.org convention -- a plain markdown link list, one per public page. */
export function buildLlmsTxt(routes, baseUrl = SITE_BASE_URL) {
  const links = routes.map((r) => `- [${r.topicId}](${baseUrl}${r.path})`).join('\n');
  return `# SSBMax\n\n> SSB (Services Selection Board) preparation for Indian Armed Forces officer selection -- psychology tests, GTO tasks, and interview preparation guides.\n\n## Guides\n\n${links}\n`;
}
