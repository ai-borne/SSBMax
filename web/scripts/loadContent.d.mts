export interface ContentEntry {
  id: string;
  sourcePath: string;
  meta: Record<string, unknown>;
  body: string;
}

export interface FaqQuestionEntry {
  question: string;
  answer: string;
}

export interface FaqEntry {
  sourcePath: string;
  meta: Record<string, unknown>;
  body: string;
  questions: FaqQuestionEntry[];
}

export const PLACEHOLDER_BODY: string;
export const MIN_BODY_WORDS: number;
export function parseContentFile(raw: string, sourcePath: string): { meta: Record<string, unknown>; body: string };
export function assertPublishable(body: string, sourcePath: string): void;
export function loadTopics(): ContentEntry[];
export function loadStudyMaterials(): ContentEntry[];
export function parseFaqQuestions(body: string, sourcePath: string): FaqQuestionEntry[];
export function loadFaq(): FaqEntry;
