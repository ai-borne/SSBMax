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

export interface FaqQuestion {
  question: string;
  answer: string;
}

export interface FaqBundle {
  title: string;
  seoTitle: string;
  seoDescription: string;
  questions: FaqQuestion[];
}

export const SITE_BASE_URL: string;
export function escapeHtml(value: unknown): string;
export function findCssAssets(distDir: string): string[];
export function buildContentPageHtml(input: BuildContentPageHtmlInput): string;
export function buildContentPageJsonLdScripts(input: {
  topic: ContentTopic;
  seo: ContentSeo;
  path: string;
  siteBaseUrl?: string;
}): string[];
export function buildFaqPageHtml(input: { faq: FaqBundle; cssHrefs?: string[]; siteBaseUrl?: string }): string;
export function buildFaqPageJsonLdScripts(input: { faq: FaqBundle; siteBaseUrl?: string }): string[];
