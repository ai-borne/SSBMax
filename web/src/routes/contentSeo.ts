// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md): per-route <title>/description
// copy, keyed by the same ContentBundleTopicId as CONTENT_ROUTES. Phrasing is drawn from the
// real query list AI-visibility diagnostic queries in
// docs/plans/ai_search_readiness_phase0_findings.md#8, not internal naming -- HIGH 5's
// "match real query phrasing" fix applies to meta copy exactly as much as to the slug.
// useDocumentMeta (src/hooks/useDocumentMeta.ts) reads this at render time today; Phase 5's
// prerenderer will read the same table when it bakes meta tags into static HTML.
import type { ContentBundleTopicId } from '../generated/contentBundle';

export interface ContentSeo {
  title: string;
  description: string;
}

export const CONTENT_SEO: Record<ContentBundleTopicId, ContentSeo> = {
  SSB_OVERVIEW: {
    title: 'SSB Selection Process Guide: 5-Day Testing Explained | SSBMax',
    description:
      'A complete walkthrough of the SSB (Services Selection Board) 5-day selection process for Indian Armed Forces officer entry -- Screening, Psychology, GTO, and Conference.',
  },
  OIR: {
    title: 'SSB OIR Test Preparation: Officer Intelligence Rating Guide | SSBMax',
    description:
      'What the OIR test in SSB selection covers, question types, and how to prepare for Officer Intelligence Rating on Day 1 screening.',
  },
  PPDT: {
    title: 'PPDT Test Practice: Picture Perception & Discussion Guide | SSBMax',
    description:
      'How to write and narrate a PPDT (Picture Perception and Discussion Test) story in SSB screening, and prepare for the group discussion that follows it.',
  },
  PIQ_FORM: {
    title: 'SSB PIQ Form Guide: How to Fill It Correctly | SSBMax',
    description:
      'A section-by-section guide to filling out the SSB Personal Information Questionnaire (PIQ) form accurately before your interview.',
  },
  PSYCHOLOGY: {
    title: 'SSB Psychology Tests: TAT, WAT, SRT, SD Preparation Guide | SSBMax',
    description:
      'How to prepare for the TAT, WAT, SRT, and Self-Description psychology tests used in SSB selection, with format and approach for each.',
  },
  GTO: {
    title: 'SSB GTO Tasks Guide: Group Testing Officer Preparation | SSBMax',
    description:
      'Group Testing Officer (GTO) task preparation for SSB -- Group Discussion, Lecturette, Group Planning Exercise, and outdoor tasks explained.',
  },
  INTERVIEW: {
    title: 'SSB Personal Interview Guide: Officer-Like Qualities & Prep | SSBMax',
    description:
      'How the SSB personal interview is conducted, what Officer-Like Qualities (OLQs) assessors look for, and how to prepare your answers.',
  },
  CONFERENCE: {
    title: 'SSB Conference Day Guide: What Happens on Day 5 | SSBMax',
    description:
      'What to expect on SSB Conference Day, how the board reviews your performance, and how final recommendations are made.',
  },
  MEDICALS: {
    title: 'SSB Medical Examination Guide: Standards & Process | SSBMax',
    description:
      'An overview of the SSB medical examination process, common medical standards, and how to prepare for your medical tests.',
  },
};
