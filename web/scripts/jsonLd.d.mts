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

export interface JsonLdInput {
  topic: ContentTopic;
  seo: ContentSeo;
  path: string;
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
export function buildOrganizationJsonLd(siteBaseUrl?: string): Record<string, unknown>;
export function buildWebSiteJsonLd(siteBaseUrl?: string): Record<string, unknown>;
export function buildBreadcrumbListJsonLd(input: { title: string; path: string; siteBaseUrl?: string }): Record<string, unknown>;
export function buildCourseJsonLd(input: JsonLdInput): Record<string, unknown>;
export function buildContentPageJsonLd(input: JsonLdInput): Record<string, unknown>[];
export function buildFaqPageJsonLd(input: { faq: FaqBundle; siteBaseUrl?: string }): Record<string, unknown>;
export function serializeJsonLd(node: Record<string, unknown>): string;
