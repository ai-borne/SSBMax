export interface DocumentBlock {
  type: string;
  [key: string]: unknown;
}

export interface DocumentSection {
  id: string;
  slug: string;
  heading: string | null;
  level: number;
  blocks: DocumentBlock[];
}

export interface DocumentModel {
  sections: DocumentSection[];
}

export interface ContentTopicMaterial {
  id: string;
  title: string;
  sections: DocumentModel;
  estimatedReadTimeMinutes: number;
}

export interface ContentTopic {
  id: string;
  title: string;
  introductionHtml: string;
  introductionSections: DocumentModel;
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
export function buildFaqPageJsonLdFromPairs(pairs: FaqQuestion[], siteBaseUrl?: string): Record<string, unknown>;
export function buildFaqPageJsonLd(input: { faq: FaqBundle; siteBaseUrl?: string }): Record<string, unknown>;
export function buildHowToJsonLd(input: { name: string; steps: Array<{ label: string; text: string }>; siteBaseUrl?: string }): Record<string, unknown>;
export function buildSectionItemListJsonLd(input: { sections: DocumentSection[]; path: string; siteBaseUrl?: string }): Record<string, unknown>;
export function extractMythRealityFaqPairs(topic: ContentTopic): FaqQuestion[];
export function serializeJsonLd(node: Record<string, unknown>): string;
