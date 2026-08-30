export interface DocBlock {
  type: string;
  [key: string]: unknown;
}

export interface DocSection {
  id: string;
  slug: string;
  heading: string | null;
  level: number;
  blocks: DocBlock[];
}

export interface DocumentModel {
  sections: DocSection[];
}

export interface ContentTopicMaterial {
  id: string;
  title: string;
  /** Structured DocumentModel (Phase 4) -- rendered via buildDocumentHtml, not raw HTML. */
  sections: DocumentModel;
  estimatedReadTimeMinutes: number;
}

export interface ContentTopic {
  id: string;
  title: string;
  /** Pre-rendered HTML (build-time markdown->HTML), not raw markdown. */
  introductionHtml: string;
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
  cfBeaconToken?: string;
}

export interface FaqQuestion {
  question: string;
  answer: string;
  answerBlocks: DocBlock[];
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
export function buildFaqPageHtml(input: { faq: FaqBundle; cssHrefs?: string[]; siteBaseUrl?: string; cfBeaconToken?: string }): string;
export function buildFaqPageJsonLdScripts(input: { faq: FaqBundle; siteBaseUrl?: string }): string[];
