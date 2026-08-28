export interface ContentTopicMaterial {
  id: string;
  title: string;
  contentMarkdown: string;
  estimatedReadTimeMinutes: number;
}

export interface ContentTopic {
  id: string;
  title: string;
  introduction: string;
  materials: ContentTopicMaterial[];
}

export interface ContentSeo {
  title: string;
  description: string;
}

export interface BuildContentPageHtmlInput {
  topic: ContentTopic;
  seo: ContentSeo;
  path: string;
  cssHrefs?: string[];
  siteBaseUrl?: string;
}

export const SITE_BASE_URL: string;
export function escapeHtml(value: unknown): string;
export function findCssAssets(distDir: string): string[];
export function buildContentPageHtml(input: BuildContentPageHtmlInput): string;
