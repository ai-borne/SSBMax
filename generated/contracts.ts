/**
 * DO NOT EDIT. Generated file — hand edits will be overwritten and are
 * caught by `npm run contracts:check` in CI / pre-commit.
 *
 * Source: firestore-paths.yaml, enums.yaml, subscription.yaml, test-config.yaml, events.yaml, routes.yaml, tokens.yaml (contracts/README.md documents the SSOT policy)
 * Regenerate: node scripts/generate-contracts.js
 *
 * SRP justification for exceeding the project 300-LOC limit: this file has
 * exactly one responsibility — mirror its YAML contract sources 1:1 into
 * this target language. Splitting it would break that 1:1 mapping. See
 * contracts/README.md "Generated-file LOC exemption".
 */

export const FirestorePaths = {
  SUBMISSIONS: "submissions",
  SUBMISSIONS_ARCHIVE_GROUP: "submissions",
  ARCHIVED_SUBMISSIONS: "archived_submissions",
  GTO_RESULTS: "gto_results",
  PPDT_RESULTS: "ppdt_results",
  INTERVIEW_SESSIONS: "interview_sessions",
  INTERVIEW_RESPONSES: "interview_responses",
  USERS: "users",
  STUDY_MATERIALS: "study_materials",
  TEST_CONTENT: "test_content",
  INTERVIEW_RESULTS: "interview_results",
  INTERVIEW_QUESTIONS: "interview_questions",
  STUDY_PROGRESS: "study_progress",
  STUDY_SESSIONS: "study_sessions",
  QUESTION_CACHE: "question_cache",
  GENERIC_QUESTIONS: "generic_questions",
  QUESTION_USAGE: "question_usage",
  NOTIFICATIONS: "notifications",
  FCM_TOKENS: "fcmTokens",
  NOTIFICATION_PREFERENCES: "notificationPreferences",
  PSYCH_RESULTS: "psych_results",
  USER_PROGRESS: "user_progress",
  TEST_SESSIONS: "test_sessions",
  CONTENT_VERSIONS: "content_versions",
  TOPIC_CONTENT: "topic_content",
  HEALTH_CHECK: "health_check",
  PAYMENTS: "payments",
  WEBHOOK_LOGS: "webhook_logs",
  USER_DATA_SUBCOLLECTION: "data",
  USER_SUBSCRIPTION_SUBCOLLECTION: "subscription",
  USER_PROFILE_DOC_ID: "profile",
  USER_SUBSCRIPTION_TIER_DOC_ID: "subscription",
  CONTENT_VERSIONS_GLOBAL_DOC_ID: "global",
  FEATURE_FLAGS: "feature_flags",
  FEATURE_FLAGS_CONFIG_DOC_ID: "config",
  TestContent: {
    OIR_BATCHES: "test_content/oir/batches",
    OIR_META_CONFIG: "test_content/oir/meta/config",
    PPDT_BATCHES: "test_content/ppdt/image_batches",
    PPDT_META_CONFIG: "test_content/ppdt/meta/config",
    TAT_BATCHES: "test_content/tat/image_batches",
    TAT_META_CONFIG: "test_content/tat/meta/config",
    WAT_BATCHES: "test_content/wat/word_batches",
    WAT_META_CONFIG: "test_content/wat/meta/config",
    SRT_BATCHES: "test_content/srt/situation_batches",
    SRT_META_CONFIG: "test_content/srt/meta/config",
    GTO_BATCHES: "test_content/gto/task_batches",
    GTO_META_CONFIG: "test_content/gto/meta/config",
    GPE_BATCHES: "test_content/gto/scenarios/gpe/batches",
    GPE_META_CONFIG: "test_content/gto/scenarios/gpe/meta/config",
  },
} as const;

export type TestType = "OIR" | "PPDT" | "PIQ" | "TAT" | "WAT" | "SRT" | "SD" | "GTO_GD" | "GTO_GPE" | "GTO_PGT" | "GTO_GOR" | "GTO_HGT" | "GTO_LECTURETTE" | "GTO_IO" | "GTO_CT" | "IO";
export const TestTypeValues: TestType[] = ["OIR", "PPDT", "PIQ", "TAT", "WAT", "SRT", "SD", "GTO_GD", "GTO_GPE", "GTO_PGT", "GTO_GOR", "GTO_HGT", "GTO_LECTURETTE", "GTO_IO", "GTO_CT", "IO"];

export type TestPhase = "PHASE_1" | "PHASE_2";
export const TestPhaseValues: TestPhase[] = ["PHASE_1", "PHASE_2"];

export type TestStatus = "NOT_ATTEMPTED" | "IN_PROGRESS" | "SUBMITTED_PENDING_REVIEW" | "GRADED" | "COMPLETED";
export const TestStatusValues: TestStatus[] = ["NOT_ATTEMPTED", "IN_PROGRESS", "SUBMITTED_PENDING_REVIEW", "GRADED", "COMPLETED"];

export type SubscriptionTier = "FREE" | "PRO" | "PREMIUM";
export const SubscriptionTierValues: SubscriptionTier[] = ["FREE", "PRO", "PREMIUM"];

export type OIRQuestionType = "VERBAL_REASONING" | "NON_VERBAL_REASONING" | "NUMERICAL_ABILITY" | "SPATIAL_REASONING";
export const OIRQuestionTypeValues: OIRQuestionType[] = ["VERBAL_REASONING", "NON_VERBAL_REASONING", "NUMERICAL_ABILITY", "SPATIAL_REASONING"];

export interface OLQDef { id: string; displayName: string; category: string; critical: boolean; }
export const OLQ: Record<string, OLQDef> = {
  EFFECTIVE_INTELLIGENCE: { id: "EFFECTIVE_INTELLIGENCE", displayName: "Effective Intelligence", category: "INTELLECTUAL", critical: false },
  REASONING_ABILITY: { id: "REASONING_ABILITY", displayName: "Reasoning Ability", category: "INTELLECTUAL", critical: true },
  ORGANIZING_ABILITY: { id: "ORGANIZING_ABILITY", displayName: "Organizing Ability", category: "INTELLECTUAL", critical: false },
  POWER_OF_EXPRESSION: { id: "POWER_OF_EXPRESSION", displayName: "Power of Expression", category: "INTELLECTUAL", critical: false },
  SOCIAL_ADJUSTMENT: { id: "SOCIAL_ADJUSTMENT", displayName: "Social Adjustment", category: "SOCIAL", critical: true },
  COOPERATION: { id: "COOPERATION", displayName: "Cooperation", category: "SOCIAL", critical: true },
  SENSE_OF_RESPONSIBILITY: { id: "SENSE_OF_RESPONSIBILITY", displayName: "Sense of Responsibility", category: "SOCIAL", critical: true },
  INITIATIVE: { id: "INITIATIVE", displayName: "Initiative", category: "DYNAMIC", critical: false },
  SELF_CONFIDENCE: { id: "SELF_CONFIDENCE", displayName: "Self Confidence", category: "DYNAMIC", critical: false },
  SPEED_OF_DECISION: { id: "SPEED_OF_DECISION", displayName: "Speed of Decision", category: "DYNAMIC", critical: false },
  INFLUENCE_GROUP: { id: "INFLUENCE_GROUP", displayName: "Ability to Influence Group", category: "DYNAMIC", critical: false },
  LIVELINESS: { id: "LIVELINESS", displayName: "Liveliness", category: "DYNAMIC", critical: true },
  DETERMINATION: { id: "DETERMINATION", displayName: "Determination", category: "CHARACTER", critical: false },
  COURAGE: { id: "COURAGE", displayName: "Courage", category: "CHARACTER", critical: true },
  STAMINA: { id: "STAMINA", displayName: "Stamina", category: "CHARACTER", critical: false },
};

export type OLQCategory = "INTELLECTUAL" | "SOCIAL" | "DYNAMIC" | "CHARACTER";
export const OLQCategoryValues: OLQCategory[] = ["INTELLECTUAL", "SOCIAL", "DYNAMIC", "CHARACTER"];

export interface SubscriptionLimit { bucket: string; testTypes: string[]; free: number; pro: number; premium: number; }
export const SubscriptionLimits: SubscriptionLimit[] = [
  { bucket: "OIR", testTypes: ["OIR"], free: 1, pro: 5, premium: -1 },
  { bucket: "PPDT", testTypes: ["PPDT"], free: 1, pro: 5, premium: -1 },
  { bucket: "PIQ", testTypes: ["PIQ"], free: 1, pro: -1, premium: -1 },
  { bucket: "TAT", testTypes: ["TAT"], free: 0, pro: 3, premium: -1 },
  { bucket: "WAT", testTypes: ["WAT"], free: 0, pro: 3, premium: -1 },
  { bucket: "SRT", testTypes: ["SRT"], free: 0, pro: 3, premium: -1 },
  { bucket: "SD", testTypes: ["SD"], free: 0, pro: 3, premium: -1 },
  { bucket: "GTO", testTypes: ["GTO_GD", "GTO_GPE", "GTO_PGT", "GTO_GOR", "GTO_HGT", "GTO_LECTURETTE", "GTO_IO", "GTO_CT"], free: 0, pro: 3, premium: -1 },
  { bucket: "INTERVIEW", testTypes: ["IO"], free: 0, pro: 1, premium: 3 },
];

export interface TestConfigEntry { testType: string; values: Record<string, unknown>; }
export const TestConfig: TestConfigEntry[] = [
  { testType: "OIR", values: { "totalQuestions": 50 } },
  { testType: "PPDT", values: { "viewingSeconds": 30, "writingSeconds": 240, "minChars": 200, "maxChars": 1500 } },
  { testType: "TAT", values: { "totalPictures": 12, "blankCardSlideNumber": 12, "viewingSeconds": 30, "writingSeconds": 240, "minChars": 150, "maxChars": 1500 } },
  { testType: "WAT", values: { "totalWords": 60, "secondsPerWord": 15, "totalSeconds": 900 } },
  { testType: "SRT", values: { "totalSituations": 60, "totalSeconds": 1800 } },
  { testType: "SD", values: { "totalQuestions": 4, "totalSeconds": 900, "maxWordsPerQuestion": 1000 } },
  { testType: "GTO_GD", values: { "totalSeconds": 1200 } },
  { testType: "GTO_GPE", values: { "viewingSeconds": 60, "planningSeconds": 1740, "totalSeconds": 1800 } },
  { testType: "GTO_LECTURETTE", values: { "speechSeconds": 180 } },
  { testType: "GTO_PGT", values: { "totalSeconds": 1800 } },
  { testType: "GTO_HGT", values: { "totalSeconds": 900 } },
  { testType: "GTO_GOR", values: { "totalSeconds": 1200 } },
  { testType: "GTO_IO", values: { "totalSeconds": 1800 } },
  { testType: "GTO_CT", values: { "totalSeconds": 900 } },
];

export const SecurityEvents = {
  UNAUTHENTICATED_ACCESS: "sec_unauth_test_access",
  LIMIT_REACHED: "sec_limit_reached",
} as const;

export const Routes = {
  MINIMUM_SUPPORTED_APP_VERSION: "1.0.0",
  SPLASH: "splash",
  LOGIN: "login",
  ROLE_SELECTION: "role_selection",
  STUDENT_HOME: "student/home",
  STUDENT_TESTS: "student/tests",
  STUDENT_SUBMISSIONS: "student/submissions",
  STUDENT_STUDY: "student/study",
  STUDENT_PROFILE: "student/profile",
  INSTRUCTOR_HOME: "instructor/home",
  INSTRUCTOR_STUDENTS: "instructor/students",
  INSTRUCTOR_GRADING: "instructor/grading",
  INSTRUCTOR_ANALYTICS: "instructor/analytics",
  INSTRUCTOR_STUDENT_DETAIL: "instructor/student/{studentId}",
  INSTRUCTOR_GRADING_DETAIL: "instructor/grading/{submissionId}",
  PHASE1_DETAIL: "phase1/detail",
  PHASE2_DETAIL: "phase2/detail",
  TEST_OIR: "test/oir/{testId}",
  TEST_OIR_RESULT: "test/oir/result/{submissionId}",
  TEST_OIR_REVIEW: "test/oir/review/{submissionId}",
  TEST_PPDT: "test/ppdt/{testId}",
  TEST_PPDT_RESULT: "test/ppdt/result/{submissionId}",
  TEST_TAT: "test/tat/{testId}",
  TEST_TAT_RESULT: "test/tat/result/{submissionId}",
  TEST_WAT: "test/wat/{testId}",
  TEST_WAT_RESULT: "test/wat/result/{submissionId}",
  TEST_SRT: "test/srt/{testId}",
  TEST_SRT_RESULT: "test/srt/result/{submissionId}",
  TEST_SD: "test/sd/{testId}",
  TEST_SD_RESULT: "test/sd/result/{submissionId}",
  TEST_PIQ: "test/piq/{testId}",
  TEST_PIQ_RESULT: "test/piq/result/{submissionId}",
  TEST_GTO: "test/gto/{testId}",
  TEST_GTO_GD: "test/gto/gd/{testId}",
  TEST_GTO_GD_RESULT: "test/gto/gd/result/{submissionId}",
  TEST_GTO_LECTURETTE: "test/gto/lecturette/{testId}",
  TEST_GTO_LECTURETTE_RESULT: "test/gto/lecturette/result/{submissionId}",
  TEST_GTO_GPE: "test/gto/gpe/{testId}",
  TEST_GTO_GPE_RESULT: "test/gto/gpe/result/{submissionId}",
  TEST_IO: "test/io/{testId}",
  INTERVIEW_START: "interview/start",
  INTERVIEW_VOICE: "interview/voice/{sessionId}",
  INTERVIEW_RESULT: "interview/result/{resultId}",
  STUDY_MATERIALS: "study/materials",
  STUDY_MATERIAL_CATEGORY: "study/material/{categoryId}",
  TOPIC_DETAIL: "topic/{topicId}",
  PREMIUM_UPGRADE: "premium/upgrade",
  NOTIFICATIONS_CENTER: "notifications/center",
  SETTINGS: "settings",
  SETTINGS_SUBSCRIPTION: "settings/subscription",
  ANALYTICS: "analytics",
  RESULTS_HISTORIC: "results/historic",
  USER_PROFILE: "user/profile",
  MARKETPLACE: "marketplace",
  SSB_OVERVIEW: "ssb/overview",
  FAQ: "faq",
  UPGRADE: "upgrade",
  PAYMENT: "payment",
  PAYMENT_SUCCESS: "payment/success",
  BATCH_JOIN: "batch/join",
  BATCH_CREATE: "batch/create",
  BATCH_DETAIL: "batch/{batchId}",
  SUBMISSION_DETAIL: "submission/{submissionId}",
} as const;

export interface Palette {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  gold: string;
  goldSubtle: string;
  emerald: string;
  emeraldSubtle: string;
  violet: string;
  violetSubtle: string;
  day1: string;
  day2: string;
  day34: string;
  day5: string;
}
export const DesignTokens: { light: Palette; dark: Palette } = {
  light: {
    bgPrimary: "#f8fafc",
    bgSecondary: "#ffffff",
    bgCard: "#ffffff",
    bgElevated: "#f1f5f9",
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    border: "#e2e8f0",
    borderSubtle: "#f1f5f9",
    accent: "#0284c7",
    accentHover: "#0369a1",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#0284c7",
    gold: "#d97706",
    goldSubtle: "#d977061a",
    emerald: "#059669",
    emeraldSubtle: "#0596691a",
    violet: "#7c3aed",
    violetSubtle: "#7c3aed1a",
    day1: "#4f46e5",
    day2: "#7c3aed",
    day34: "#0d9488",
    day5: "#d97706",
  },
  dark: {
    bgPrimary: "#0b0f19",
    bgSecondary: "#0f172a",
    bgCard: "#1e293b",
    bgElevated: "#334155",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    border: "#334155",
    borderSubtle: "#1e293b",
    accent: "#38bdf8",
    accentHover: "#0284c7",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#38bdf8",
    gold: "#f59e0b",
    goldSubtle: "#f59e0b1a",
    emerald: "#10b981",
    emeraldSubtle: "#10b9811a",
    violet: "#8b5cf6",
    violetSubtle: "#8b5cf61a",
    day1: "#6366f1",
    day2: "#8b5cf6",
    day34: "#14b8a6",
    day5: "#f59e0b",
  },
};
