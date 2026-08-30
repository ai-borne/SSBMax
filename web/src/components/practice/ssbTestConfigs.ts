import { strings } from '../../constants/strings';
import { GTO_TASKS, AccessTier, SSBDayNumber } from '../../constants/ssbSelectionProcess';
import { TestType } from '../../generated/contracts';

export interface TestSimulatorConfig {
  id: string;
  testTypeId: string;
  /**
   * Bucket lookup key for `checkTestEligibility` (contracts/subscription.yaml). All 7 gradeable
   * GTO sub-tests (GD/GPE/PGT/HGT/IO/GOR/CT) resolve to the same "GTO" bucket and map 1:1 to
   * their contract `TestType` member. `fgt` is undefined here — it's a non-gradable,
   * study-content-only label with no matching `GTOSubmission` variant or contract member.
   */
  contractTestType?: TestType;
  shortCode: string;
  dayNumber: SSBDayNumber;
  title: string;
  description: string;
  timeLimit: string;
  requiredTier: AccessTier;
  stageBadge: string;
  olqsEvaluated?: string[];
  isMostPopular?: boolean;
}

/**
 * `fgt` (Final Group Task) has no matching `GTOSubmission` variant or contract `TestType`
 * member — it is a non-gradable, study-content-only label (`StudyMaterialsProvider.kt`'s
 * "Snake Race & FGT Strategies" item), so it is intentionally omitted here and left with no
 * `contractTestType` (see DAY_3_4_TESTS below). `snake_race` (shortCode GOR) IS a real
 * gradeable type — `GTOSubmission.GORSubmission` / `GTOTestType.GROUP_OBSTACLE_RACE` — and
 * keeps its 1:1 `GTO_GOR` mapping.
 */
const GTO_CONTRACT_TYPE_BY_ID: Record<string, TestType> = {
  gd: 'GTO_GD',
  gpe: 'GTO_GPE',
  pgt: 'GTO_PGT',
  hgt: 'GTO_HGT',
  iot: 'GTO_IO',
  command_task: 'GTO_CT',
  snake_race: 'GTO_GOR',
  lecturette: 'GTO_LECTURETTE',
  fgt: 'GTO_FGT',
};

export const DAY_1_TESTS: TestSimulatorConfig[] = [
  {
    id: 'oir',
    testTypeId: 'oir',
    shortCode: 'OIR',
    dayNumber: '1',
    title: strings.practice.oirTitle,
    description: strings.practice.oirDesc,
    timeLimit: '50 Qs / 30m',
    contractTestType: 'OIR',
    requiredTier: 'FREE',
    stageBadge: 'Stage I Screening',
    olqsEvaluated: ['Effective Intelligence', 'Reasoning Ability'],
  },
  {
    id: 'ppdt',
    testTypeId: 'ppdt',
    shortCode: 'PPDT',
    dayNumber: '1',
    title: strings.practice.ppdtTitle,
    description: strings.practice.ppdtDesc,
    timeLimit: '30s view / 4m write',
    contractTestType: 'PPDT',
    requiredTier: 'PRO',
    stageBadge: 'Stage I Screening',
    olqsEvaluated: ['Power of Expression', 'Social Adaptability', 'Group Influencing Ability'],
    isMostPopular: true,
  },
];

export const DAY_2_TESTS: TestSimulatorConfig[] = [
  {
    id: 'piq',
    testTypeId: 'piq',
    shortCode: 'PIQ',
    dayNumber: '2',
    title: 'Personal Information Questionnaire (PIQ)',
    description: 'Step-by-step Personal Information Questionnaire wizard with 1-tap preset chips.',
    timeLimit: '15m Profile Build',
    contractTestType: 'PIQ',
    requiredTier: 'FREE',
    stageBadge: 'Stage II Psychology',
    olqsEvaluated: ['Organising Ability', 'Sense of Responsibility'],
  },
  {
    id: 'tat',
    testTypeId: 'tat',
    shortCode: 'TAT',
    dayNumber: '2',
    title: strings.practice.tatTitle,
    description: strings.practice.tatDesc,
    timeLimit: '12 Slides / 48m',
    contractTestType: 'TAT',
    requiredTier: 'PRO',
    stageBadge: 'Stage II Psychology',
    olqsEvaluated: ['Effective Intelligence', 'Emotional Stability', 'Liveliness'],
    isMostPopular: true,
  },
  {
    id: 'wat',
    testTypeId: 'wat',
    shortCode: 'WAT',
    dayNumber: '2',
    title: strings.practice.watTitle,
    description: strings.practice.watDesc,
    timeLimit: '60 Words / 15m',
    contractTestType: 'WAT',
    requiredTier: 'PRO',
    stageBadge: 'Stage II Psychology',
    olqsEvaluated: ['Speed of Decision', 'Self Confidence', 'Initiative'],
  },
  {
    id: 'srt',
    testTypeId: 'srt',
    shortCode: 'SRT',
    dayNumber: '2',
    title: strings.practice.srtTitle,
    description: strings.practice.srtDesc,
    timeLimit: '60 Situations / 30m',
    contractTestType: 'SRT',
    requiredTier: 'PRO',
    stageBadge: 'Stage II Psychology',
    olqsEvaluated: ['Practical Intelligence', 'Resourcefulness', 'Cooperation'],
  },
  {
    id: 'sd',
    testTypeId: 'sd',
    shortCode: 'SD',
    dayNumber: '2',
    title: strings.practice.sdTitle,
    description: strings.practice.sdDesc,
    timeLimit: '5 Paragraphs / 15m',
    contractTestType: 'SD',
    requiredTier: 'PRO',
    stageBadge: 'Stage II Psychology',
    olqsEvaluated: ['Self Awareness', 'Determination', 'Integrity'],
  },
];

export const DAY_3_4_TESTS: TestSimulatorConfig[] = GTO_TASKS.map((gto) => ({
  id: gto.id,
  testTypeId: gto.testTypeId,
  contractTestType: GTO_CONTRACT_TYPE_BY_ID[gto.id],
  shortCode: gto.shortCode,
  dayNumber: '3-4',
  title: gto.titleKey,
  description: gto.descriptionKey,
  timeLimit: `${gto.timeLimitMinutes} Mins`,
  requiredTier: gto.accessTier,
  stageBadge: 'Stage II GTO Outdoor',
  olqsEvaluated: gto.olqsEvaluated,
}));

export const DAY_5_TESTS: TestSimulatorConfig[] = [
  {
    id: 'interview',
    testTypeId: 'interview',
    shortCode: 'IO',
    dayNumber: '5',
    title: strings.practice.interviewTitle,
    description: strings.practice.interviewDesc,
    timeLimit: '45m IO Session',
    contractTestType: 'IO',
    requiredTier: 'PRO',
    stageBadge: 'Stage II Board',
    olqsEvaluated: ['Power of Expression', 'General Awareness', 'Moral Courage'],
  },
  {
    // Non-gradable content/briefing card — Board Conference/SMB standards are a protocol guide,
    // not a submittable/gradeable test, so this intentionally carries no `contractTestType`.
    id: 'conference',
    testTypeId: 'conference',
    shortCode: 'CONF',
    dayNumber: '5',
    title: 'Board Conference & SMB Standards',
    description: 'Final Assessor Board Conference simulation and Special Medical Board guidelines.',
    timeLimit: 'Protocol Guide',
    requiredTier: 'FREE',
    stageBadge: 'Stage II Board',
    olqsEvaluated: ['Overall Officer Suitability'],
  },
];

export const ALL_TEST_CONFIGS: TestSimulatorConfig[] = [
  ...DAY_1_TESTS,
  ...DAY_2_TESTS,
  ...DAY_3_4_TESTS,
  ...DAY_5_TESTS,
];

export function getTestConfigsForDay(dayNumber: SSBDayNumber): TestSimulatorConfig[] {
  switch (dayNumber) {
    case '1':
      return DAY_1_TESTS;
    case '2':
      return DAY_2_TESTS;
    case '3-4':
      return DAY_3_4_TESTS;
    case '5':
      return DAY_5_TESTS;
    default:
      return [];
  }
}

export function getTestConfigById(id: string): TestSimulatorConfig | undefined {
  return ALL_TEST_CONFIGS.find((config) => config.id === id);
}
