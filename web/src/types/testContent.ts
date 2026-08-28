/**
 * Strict Interfaces for SSBMax Test Content & Study Materials
 * Following Interface Segregation Principle (ISP)
 */

export interface OIRQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  options: string[];
  imageUrl?: string;
  type: 'VERBAL' | 'NON_VERBAL';
  // Security Note: correctAnswerIndex is omitted from client payloads for anti-cheating.
}

export interface PPDTImageContext {
  sceneDescription?: string;
  coreElements?: string[];
  ambiguousElements?: string[];
  expectedThemes?: string[];
  penalizedThemes?: string[];
  primaryOLQs?: string[];
  deviationTolerance?: string;
  exemplarGoodHints?: string[];
  exemplarBadHints?: string[];
}

export interface PPDTContext {
  id: string;
  title: string;
  imageUrl: string;
  viewingTimeSeconds: number;
  writingTimeSeconds: number;
  instructions: string[];
  imageContext?: PPDTImageContext;
}

export interface TATSet {
  id: string;
  setName: string;
  imageUrls: string[];
  /**
   * Per-image content ids, parallel to `imageUrls` (Phase 11b, Web SSB Test Flow
   * Parity plan) -- these must match `test_content/tat/image_batches/{batchId}`'s
   * `images[].id` field exactly, since `tatEvaluate.js::resolveImageBatch` looks
   * images up by this id server-side and never trusts a URL from the submission
   * itself (SSRF guard). Falls back to synthetic `tat-img-N` ids when the source
   * doc has none (fallback/dev content) -- those submissions evaluate with empty
   * images, same graceful-degradation behavior other under-seeded content already has.
   */
  imageIds: string[];
  slideDurationSeconds: number;
  totalSlides: number;
}

export interface WATBatch {
  id: string;
  words: string[];
  displayDurationSeconds: number;
}

export interface SRTBatch {
  id: string;
  situations: string[];
  totalTimeMinutes: number;
}

export interface GPEImage {
  id: string;
  imageUrl: string;
  scenario: string;
  imageDescription: string;
  resources: string[];
  viewingTimeSeconds: number;
  planningTimeSeconds: number;
  minCharacters?: number;
  maxCharacters?: number;
  category?: string;
  difficulty?: string;
  // Security Note: `solution` is omitted from client payloads, mirroring OIR's
  // correctAnswerIndex anti-cheating stripping (see GitLiveGPEImageCacheManager DTO).
}

export interface OIRContentMeta {
  contentVersion: number;
  batchCount: number;
}

export interface SDPrompt {
  id: string;
  categories: {
    key: string;
    title: string;
    description: string;
  }[];
}

export interface InterviewQuestion {
  id: string;
  category: string;
  questionText: string;
  expectedOLQs: string[];
}

export interface OLQAnalysis {
  rating: number; // 1 to 5
  olqBreakdown: Record<string, number>;
  strengths: string[];
  areasOfImprovement: string[];
  recommendations: string[];
}

export interface StudyMaterial {
  id: string;
  title: string;
  category: string;
  summary: string;
  contentMarkdown: string;
  estimatedReadTimeMinutes: number;
  tags: string[];
  createdAt: string;
  dayNumber?: '1' | '2' | '3-4' | '5';
  testTypeId?: 'oir' | 'ppdt' | 'piq' | 'tat' | 'wat' | 'srt' | 'sd' | 'gd' | 'gpe' | 'pgt' | 'hgt' | 'iot' | 'command_task' | 'snake_race' | 'fgt' | 'interview' | 'conference';
  /** Raw Firestore `topicType` (e.g. "GTO", "PSYCHOLOGY") -- see constants/topicTypeMapping.ts. */
  topicType?: string;
}

export interface BatchDocument<T> {
  id: string;
  batchIndex: number;
  totalItems: number;
  items: T[];
}

export interface TestBatchInfo {
  id: string;
  name: string;
  itemCount?: number;
}

