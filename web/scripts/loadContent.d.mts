export interface ContentEntry {
  id: string;
  sourcePath: string;
  meta: Record<string, unknown>;
  body: string;
}

export const PLACEHOLDER_BODY: string;
export const MIN_BODY_WORDS: number;
export function parseContentFile(raw: string, sourcePath: string): { meta: Record<string, unknown>; body: string };
export function assertPublishable(body: string, sourcePath: string): void;
export function loadTopics(): ContentEntry[];
export function loadStudyMaterials(): ContentEntry[];
