import { strings } from './strings';

export type SSBDayNumber = '1' | '2' | '3-4' | '5';
export type AccessTier = 'cadet' | 'officer' | 'command';
export type GTOTaskCategory = 'indoor' | 'outdoor' | 'individual' | 'group';

export interface GTOTask {
  id: string;
  number: number;
  shortCode: string;
  testTypeId: string;
  titleKey: string;
  descriptionKey: string;
  category: GTOTaskCategory;
  timeLimitMinutes: number;
  accessTier: AccessTier;
  olqsEvaluated: string[];
}

export interface SSBDayOverview {
  dayNumber: SSBDayNumber;
  stageBadge: string;
  title: string;
  subtitle: string;
  testCount: number;
  testTypeIds: string[];
}

export interface SubscriptionTierInfo {
  id: AccessTier;
  title: string;
  price: string;
  badge: string;
  isPopular?: boolean;
  features: string[];
  buttonText: string;
  accessLevel: number;
}

export const GTO_TASKS: GTOTask[] = [
  {
    id: 'gd',
    number: 1,
    shortCode: 'GD',
    testTypeId: 'gd',
    titleKey: strings.gto.gdTitle,
    descriptionKey: strings.gto.gdDesc,
    category: 'indoor',
    timeLimitMinutes: 30,
    accessTier: 'cadet',
    olqsEvaluated: ['Effective Intelligence', 'Reasoning Ability', 'Power of Expression', 'Social Adaptability'],
  },
  {
    id: 'gpe',
    number: 2,
    shortCode: 'GPE',
    testTypeId: 'gpe',
    titleKey: strings.gto.gpeTitle,
    descriptionKey: strings.gto.gpeDesc,
    category: 'indoor',
    timeLimitMinutes: 45,
    accessTier: 'officer',
    olqsEvaluated: ['Organising Ability', 'Reasoning Ability', 'Cooperation', 'Sense of Responsibility'],
  },
  {
    id: 'pgt',
    number: 3,
    shortCode: 'PGT',
    testTypeId: 'pgt',
    titleKey: strings.gto.pgtTitle,
    descriptionKey: strings.gto.pgtDesc,
    category: 'outdoor',
    timeLimitMinutes: 45,
    accessTier: 'officer',
    olqsEvaluated: ['Group Influencing Ability', 'Initiative', 'Cooperation', 'Practical Intelligence'],
  },
  {
    id: 'hgt',
    number: 4,
    shortCode: 'HGT',
    testTypeId: 'hgt',
    titleKey: strings.gto.hgtTitle,
    descriptionKey: strings.gto.hgtDesc,
    category: 'outdoor',
    timeLimitMinutes: 15,
    accessTier: 'officer',
    olqsEvaluated: ['Leadership', 'Resourcefulness', 'Determination', 'Stamina'],
  },
  {
    id: 'iot',
    number: 5,
    shortCode: 'IOT',
    testTypeId: 'iot',
    titleKey: strings.gto.iotTitle,
    descriptionKey: strings.gto.iotDesc,
    category: 'individual',
    timeLimitMinutes: 3,
    accessTier: 'cadet',
    olqsEvaluated: ['Courage', 'Physical Stamina', 'Determination', 'Self Confidence'],
  },
  {
    id: 'command_task',
    number: 6,
    shortCode: 'CT',
    testTypeId: 'command_task',
    titleKey: strings.gto.ctTitle,
    descriptionKey: strings.gto.ctDesc,
    category: 'outdoor',
    timeLimitMinutes: 15,
    accessTier: 'officer',
    olqsEvaluated: ['Command & Control', 'Decision Making', 'Resource Allocation', 'Ability to Influence Group'],
  },
  {
    id: 'snake_race',
    number: 7,
    shortCode: 'GOR',
    testTypeId: 'snake_race',
    titleKey: strings.gto.gorTitle,
    descriptionKey: strings.gto.gorDesc,
    category: 'group',
    timeLimitMinutes: 30,
    accessTier: 'cadet',
    olqsEvaluated: ['Liveliness', 'Group Dynamics', 'Cooperation', 'Physical Stamina'],
  },
  {
    id: 'fgt',
    number: 8,
    shortCode: 'FGT',
    testTypeId: 'fgt',
    titleKey: strings.gto.fgtTitle,
    descriptionKey: strings.gto.fgtDesc,
    category: 'outdoor',
    timeLimitMinutes: 20,
    accessTier: 'officer',
    olqsEvaluated: ['Teamwork', 'Final Execution', 'Sense of Responsibility', 'Consistency'],
  },
];

export const SSB_5_DAY_TIMELINE: SSBDayOverview[] = [
  {
    dayNumber: '1',
    stageBadge: 'Stage I Screening',
    title: strings.studyMaterial.day1Title,
    subtitle: 'Officer Intelligence Rating (OIR) Verbal/Non-Verbal Reasoning & Picture Perception & Discussion Test (PPDT).',
    testCount: 2,
    testTypeIds: ['oir', 'ppdt'],
  },
  {
    dayNumber: '2',
    stageBadge: 'Stage II Psychology',
    title: strings.studyMaterial.day2Title,
    subtitle: 'Personal Information Questionnaire (PIQ) & Psych battery (TAT, WAT, SRT, Self Description).',
    testCount: 5,
    testTypeIds: ['piq', 'tat', 'wat', 'srt', 'sd'],
  },
  {
    dayNumber: '3-4',
    stageBadge: 'Stage II Outdoor & GTO',
    title: strings.studyMaterial.day3Title,
    subtitle: 'All 8 Group Testing Officer (GTO) indoor & outdoor obstacles and tasks.',
    testCount: 8,
    testTypeIds: ['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt'],
  },
  {
    dayNumber: '5',
    stageBadge: 'Stage II Final Board',
    title: strings.studyMaterial.day5Title,
    subtitle: 'Personal Interview dossier review, Board Conference protocol, and SMB medicals.',
    testCount: 2,
    testTypeIds: ['interview', 'conference'],
  },
];

export const SUBSCRIPTION_TIERS: SubscriptionTierInfo[] = [
  {
    id: 'cadet',
    title: strings.subscription.cadetTitle,
    price: strings.subscription.cadetPrice,
    badge: strings.subscription.cadetBadge,
    isPopular: false,
    features: [
      strings.subscription.cadetFeature1,
      strings.subscription.cadetFeature2,
      strings.subscription.cadetFeature3,
      strings.subscription.cadetFeature4,
    ],
    buttonText: strings.subscription.cadetButton,
    accessLevel: 0,
  },
  {
    id: 'officer',
    title: strings.subscription.officerTitle,
    price: strings.subscription.officerPrice,
    badge: strings.subscription.officerBadge,
    isPopular: true,
    features: [
      strings.subscription.officerFeature1,
      strings.subscription.officerFeature2,
      strings.subscription.officerFeature3,
      strings.subscription.officerFeature4,
    ],
    buttonText: strings.subscription.officerButton,
    accessLevel: 1,
  },
  {
    id: 'command',
    title: strings.subscription.commandTitle,
    price: strings.subscription.commandPrice,
    badge: strings.subscription.commandBadge,
    isPopular: false,
    features: [
      strings.subscription.commandFeature1,
      strings.subscription.commandFeature2,
      strings.subscription.commandFeature3,
      strings.subscription.commandFeature4,
    ],
    buttonText: strings.subscription.commandButton,
    accessLevel: 2,
  },
];

export function getGTOTaskById(id: string): GTOTask | undefined {
  return GTO_TASKS.find((task) => task.id === id);
}

export function getGTOTasksByTier(tier: AccessTier): GTOTask[] {
  const targetLevel = getTierAccessLevel(tier);
  return GTO_TASKS.filter((task) => getTierAccessLevel(task.accessTier) <= targetLevel);
}

export function getDayOverview(dayNumber: SSBDayNumber): SSBDayOverview | undefined {
  return SSB_5_DAY_TIMELINE.find((day) => day.dayNumber === dayNumber);
}

export function getTierAccessLevel(tier: AccessTier): number {
  switch (tier) {
    case 'command':
      return 2;
    case 'officer':
      return 1;
    case 'cadet':
    default:
      return 0;
  }
}

export function hasTierAccess(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return getTierAccessLevel(userTier) >= getTierAccessLevel(requiredTier);
}
