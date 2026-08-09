import { SSBTestCardInfo } from './StudyTestCard';
import { StudyMaterial } from '../../types/testContent';
import { getDayOverview } from '../../constants/ssbSelectionProcess';

export interface DaySectionConfig {
  dayNumber: '1' | '2' | '3-4' | '5';
  stageBadge: string;
  title: string;
  subtitle: string;
  getTestCards: (getMaterialsForTest: (testTypeId: string) => StudyMaterial[]) => SSBTestCardInfo[];
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
        requiredTier: 'cadet',
        materials: getMaterials('oir'),
      },
      {
        id: 'ppdt',
        testTypeId: 'ppdt',
        shortCode: 'PPDT',
        title: 'Picture Perception & Discussion Test',
        description: 'Hazy image perception, story writing, narration, and group discussion tactics.',
        requiredTier: 'officer',
        materials: getMaterials('ppdt'),
      },
    ],
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
        requiredTier: 'cadet',
        materials: getMaterials('piq'),
      },
      {
        id: 'psych',
        testTypeId: 'tat',
        shortCode: 'PSYCH',
        title: 'Psychology Test Battery (TAT, WAT, SRT, SD)',
        description: 'Thematic Apperception (12 slides), Word Association (60 words), Situation Reaction (60 scenarios), and SD.',
        requiredTier: 'officer',
        materials: [
          ...getMaterials('tat'),
          ...getMaterials('wat'),
          ...getMaterials('srt'),
          ...getMaterials('sd'),
        ],
      },
    ],
  },
  {
    dayNumber: '3-4',
    stageBadge: day34Overview.stageBadge,
    title: day34Overview.title,
    subtitle: day34Overview.subtitle,
    getTestCards: (getMaterials) => [
      {
        id: 'gd',
        testTypeId: 'gd',
        shortCode: 'GD',
        title: '1. Group Discussion',
        description: 'Current affairs and defense topics group discussion techniques.',
        requiredTier: 'cadet',
        materials: getMaterials('gd'),
      },
      {
        id: 'gpe',
        testTypeId: 'gpe',
        shortCode: 'GPE',
        title: '2. Group Planning Exercise',
        description: 'Military map problem solving and group consensus planning.',
        requiredTier: 'officer',
        materials: getMaterials('gpe'),
      },
      {
        id: 'pgt',
        testTypeId: 'pgt',
        shortCode: 'PGT',
        title: '3. Progressive Group Task',
        description: 'Structures, plank, rope, and load crossing methods across 4 obstacles.',
        requiredTier: 'officer',
        materials: getMaterials('pgt'),
      },
      {
        id: 'hgt',
        testTypeId: 'hgt',
        shortCode: 'HGT',
        title: '4. Half Group Task',
        description: 'Group half-division outdoor structure assessment.',
        requiredTier: 'officer',
        materials: getMaterials('hgt'),
      },
      {
        id: 'iot',
        testTypeId: 'iot',
        shortCode: 'IOT',
        title: '5. Individual Obstacles Test',
        description: '10 individual outdoor physical obstacles and scoring strategy.',
        requiredTier: 'cadet',
        materials: getMaterials('iot'),
      },
      {
        id: 'command_task',
        testTypeId: 'command_task',
        shortCode: 'CT',
        title: '6. Command Task',
        description: 'Subordinate selection and leader obstacle execution.',
        requiredTier: 'officer',
        materials: getMaterials('command_task'),
      },
      {
        id: 'snake_race',
        testTypeId: 'snake_race',
        shortCode: 'GOR',
        title: '7. Snake Race / Group Obstacle Race',
        description: 'Group obstacle race carrying continuous load (snake).',
        requiredTier: 'cadet',
        materials: getMaterials('snake_race'),
      },
      {
        id: 'fgt',
        testTypeId: 'fgt',
        shortCode: 'FGT',
        title: '8. Final Group Task',
        description: 'Final single outdoor structure group task execution.',
        requiredTier: 'officer',
        materials: getMaterials('fgt'),
      },
    ],
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
        requiredTier: 'officer',
        materials: getMaterials('interview'),
      },
      {
        id: 'conference',
        testTypeId: 'conference',
        shortCode: 'CONF',
        title: 'Board Conference & Medicals',
        description: 'Final Assessor Board Conference protocol and Special Medical Board standards.',
        requiredTier: 'cadet',
        materials: getMaterials('conference'),
      },
    ],
  },
];
