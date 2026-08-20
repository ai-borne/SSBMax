import { strings } from './strings';
import { SubscriptionTier } from '../generated/contracts';

export type SSBDayNumber = '1' | '2' | '3-4' | '5';
/** Re-export of the KMP-authoritative generated enum — the only tier vocabulary web uses (docs/plans/CrossPlatform_SSOT Phase 4). */
export type AccessTier = SubscriptionTier;
/**
 * Mirrors `com.ssbmax.shared.domain.model.SubscriptionOverride` (both platforms use the same
 * four states, per docs/plans/CrossPlatform_SSOT Phase 4 §"Align the dev override").
 */
export type DevTierOverride = 'FOLLOW_REAL' | 'FORCE_FREE' | 'FORCE_BASIC' | 'FORCE_PRO' | 'FORCE_PREMIUM';
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    accessTier: 'PRO',
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
    id: 'FREE',
    title: strings.subscription.ribbonFreeTitle,
    price: strings.subscription.ribbonFreePrice,
    badge: strings.subscription.ribbonFreeBadge,
    isPopular: false,
    features: [
      strings.subscription.ribbonFreeFeature1,
      strings.subscription.ribbonFreeFeature2,
      strings.subscription.ribbonFreeFeature3,
      strings.subscription.ribbonFreeFeature4,
    ],
    buttonText: strings.subscription.ribbonFreeButton,
    accessLevel: 0,
  },
  {
    id: 'BASIC',
    title: strings.subscription.ribbonBasicTitle,
    price: strings.subscription.ribbonBasicPrice,
    badge: strings.subscription.ribbonBasicBadge,
    isPopular: false,
    features: [
      strings.subscription.ribbonBasicFeature1,
      strings.subscription.ribbonBasicFeature2,
      strings.subscription.ribbonBasicFeature3,
      strings.subscription.ribbonBasicFeature4,
    ],
    buttonText: strings.subscription.ribbonBasicButton,
    accessLevel: 1,
  },
  {
    id: 'PRO',
    title: strings.subscription.ribbonProTitle,
    price: strings.subscription.ribbonProPrice,
    badge: strings.subscription.ribbonProBadge,
    isPopular: true,
    features: [
      strings.subscription.ribbonProFeature1,
      strings.subscription.ribbonProFeature2,
      strings.subscription.ribbonProFeature3,
      strings.subscription.ribbonProFeature4,
    ],
    buttonText: strings.subscription.ribbonProButton,
    accessLevel: 2,
  },
  {
    id: 'PREMIUM',
    title: strings.subscription.ribbonPremiumTitle,
    price: strings.subscription.ribbonPremiumPrice,
    badge: strings.subscription.ribbonPremiumBadge,
    isPopular: false,
    features: [
      strings.subscription.ribbonPremiumFeature1,
      strings.subscription.ribbonPremiumFeature2,
      strings.subscription.ribbonPremiumFeature3,
      strings.subscription.ribbonPremiumFeature4,
    ],
    buttonText: strings.subscription.ribbonPremiumButton,
    accessLevel: 3,
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
    case 'PREMIUM':
      return 3;
    case 'PRO':
      return 2;
    case 'BASIC':
      return 1;
    case 'FREE':
    default:
      return 0;
  }
}

export function hasTierAccess(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return getTierAccessLevel(userTier) >= getTierAccessLevel(requiredTier);
}

export function getEffectiveTier(override: DevTierOverride, realTier: AccessTier): AccessTier {
  if (override === 'FORCE_FREE') return 'FREE';
  if (override === 'FORCE_BASIC') return 'BASIC';
  if (override === 'FORCE_PRO') return 'PRO';
  if (override === 'FORCE_PREMIUM') return 'PREMIUM';
  return realTier;
}
