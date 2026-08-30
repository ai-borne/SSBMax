import { SSBTestCardInfo } from './StudyTestCard';
import { StudyMaterial } from '../../types/testContent';
import { getDayOverview } from '../../constants/ssbSelectionProcess';

export interface DaySectionConfig {
  dayNumber: '1' | '2' | '3-4' | '5';
  stageBadge: string;
  title: string;
  subtitle: string;
  getTestCards: (
    getMaterialsForTest: (
      testTypeId: string,
      compositeTestTypeIds?: StudyMaterial['testTypeId'][]
    ) => StudyMaterial[]
  ) => SSBTestCardInfo[];
}

// Seniority order of the 9 GTO sub-tests (matches numbering used in their titles: 1. Group
// Discussion through 9. Final Group Task), used to order the merged GTO study-materials list.
const GTO_SUB_TEST_ORDER: StudyMaterial['testTypeId'][] = [
  'gd', 'gpe', 'pgt', 'snake_race', 'hgt', 'lecturette', 'iot', 'command_task', 'fgt'
];

function sortByGtoSeniority(materials: StudyMaterial[]): StudyMaterial[] {
  return [...materials].sort((a, b) => {
    const aIndex = a.testTypeId ? GTO_SUB_TEST_ORDER.indexOf(a.testTypeId) : -1;
    const bIndex = b.testTypeId ? GTO_SUB_TEST_ORDER.indexOf(b.testTypeId) : -1;
    return aIndex - bIndex;
  });
}

const day1Overview = getDayOverview('1')!;
const day2Overview = getDayOverview('2')!;
const day34Overview = getDayOverview('3-4')!;
const day5Overview = getDayOverview('5')!;

export const ssbDayConfigs: DaySectionConfig[] = [
  {
    dayNumber: '1',
    stageBadge: day1Overview.stageBadge,
    title: day1Overview.title,
    subtitle: day1Overview.subtitle,
    getTestCards: (getMaterials) => [
      {
        id: 'oir',
        testTypeId: 'oir',
        shortCode: 'OIR',
        title: 'Officer Intelligence Rating (OIR)',
        description: 'Verbal and Non-Verbal reasoning test batteries to achieve OIR Rating 1.',
        requiredTier: 'FREE',
        materials: getMaterials('oir')
      },
      {
        id: 'ppdt',
        testTypeId: 'ppdt',
        shortCode: 'PPDT',
        title: 'Picture Perception & Discussion Test',
        description: 'Hazy image perception, story writing, narration, and group discussion tactics.',
        requiredTier: 'PRO',
        materials: getMaterials('ppdt')
      }
    ]
  },
  {
    dayNumber: '2',
    stageBadge: day2Overview.stageBadge,
    title: day2Overview.title,
    subtitle: day2Overview.subtitle,
    getTestCards: (getMaterials) => [
      {
        id: 'piq',
        testTypeId: 'piq',
        shortCode: 'PIQ',
        title: 'Filling PIQ Form',
        description: 'Guidelines to fill the Personal Information Questionnaire without discrepancies.',
        requiredTier: 'FREE',
        materials: getMaterials('piq')
      },
      {
        id: 'psych',
        testTypeId: 'tat',
        compositeTestTypeIds: ['tat', 'wat', 'srt', 'sd'],
        shortCode: 'PSYCH',
        title: 'Psychology Test Battery (TAT, WAT, SRT, SD)',
        description: 'Thematic Apperception (12 slides), Word Association (60 words), Situation Reaction (60 scenarios), and SD.',
        requiredTier: 'PRO',
        materials: getMaterials('tat', ['tat', 'wat', 'srt', 'sd'])
      }
    ]
  },
  {
    dayNumber: '3-4',
    stageBadge: day34Overview.stageBadge,
    title: day34Overview.title,
    subtitle: day34Overview.subtitle,
    getTestCards: (getMaterials) => [
      {
        id: 'gto_materials',
        testTypeId: 'gd',
        compositeTestTypeIds: GTO_SUB_TEST_ORDER,
        shortCode: 'GTO',
        title: 'GTO Tasks (9 Sub-Tests)',
        description: 'Group Discussion, Planning Exercise, Progressive Group Task, Snake Race, Half Group Task, Lecturette, Individual Obstacles, Command Task, and Final Group Task.',
        requiredTier: 'PRO',
        materials: sortByGtoSeniority(getMaterials('gd', GTO_SUB_TEST_ORDER))
      }
    ]
  },
  {
    dayNumber: '5',
    stageBadge: day5Overview.stageBadge,
    title: day5Overview.title,
    subtitle: day5Overview.subtitle,
    getTestCards: (getMaterials) => [
      {
        id: 'interview',
        testTypeId: 'interview',
        shortCode: 'IO',
        title: 'Personal Interview',
        description: 'Interviewing Officer (IO/President) questioning dossier preparation.',
        requiredTier: 'PRO',
        materials: getMaterials('interview')
      },
      {
        id: 'conference',
        testTypeId: 'conference',
        compositeTestTypeIds: ['conference', 'interview'],
        shortCode: 'CONF',
        title: 'Board Conference & Medicals',
        description: 'Final Assessor Board Conference protocol and Special Medical Board standards.',
        requiredTier: 'FREE',
        materials: getMaterials('conference', ['conference', 'interview'])
      }
    ]
  }
];
