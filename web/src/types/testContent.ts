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

export interface PPDTContext {
  id: string;
  title: string;
  imageUrl: string;
  viewingTimeSeconds: number;
  writingTimeSeconds: number;
  instructions: string[];
}

export interface TATSet {
  id: string;
  setName: string;
  imageUrls: string[];
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
}

export interface BatchDocument<T> {
  id: string;
  batchIndex: number;
  totalItems: number;
  items: T[];
}
