export interface ContentRouteEntry {
  topicId: string;
  path: string;
}

export const SITE_BASE_URL: string;
export function loadContentRoutes(): ContentRouteEntry[];
export function buildSitemapXml(routes: ContentRouteEntry[], baseUrl?: string): string;
export function buildLlmsTxt(routes: ContentRouteEntry[], baseUrl?: string): string;
