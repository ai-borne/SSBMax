import { SSBTestCardInfo } from './StudyTestCard';
import { StudyMaterial } from '../../types/testContent';
import { strings } from '../../constants/strings';

export interface DaySectionConfig {
  dayNumber: '1' | '2' | '3-4' | '5';
  stageBadge: string;
  title: string;
  subtitle: string;
  getTestCards: (getMaterialsForTest: (testTypeId: string) => StudyMaterial[]) => SSBTestCardInfo[];
}

export const ssbDayConfigs: DaySectionConfig[] = [
  {
    dayNumber: '1',
    stageBadge: 'Stage I Screening',
    title: strings.studyMaterial.day1Title,
    subtitle: 'Officer Intelligence Rating (OIR) Verbal/Non-Verbal Reasoning & Picture Perception & Discussion Test (PPDT).',
    getTestCards: (getMaterials) => [
      {
        id: 'oir',
        testTypeId: 'oir',
        shortCode: 'OIR',
        title: 'Officer Intelligence Rating (OIR)',
        description: 'Verbal and Non-Verbal reasoning test batteries to achieve OIR Rating 1.',
        materials: getMaterials('oir'),
      },
      {
        id: 'ppdt',
        testTypeId: 'ppdt',
        shortCode: 'PPDT',
        title: 'Picture Perception & Discussion Test',
        description: 'Hazy image perception, story writing, narration, and group discussion tactics.',
        materials: getMaterials('ppdt'),
      },
    ],
  },
  {
    dayNumber: '2',
    stageBadge: 'Stage II Psychology',
    title: strings.studyMaterial.day2Title,
    subtitle: 'Personal Information Questionnaire (PIQ) & Psych battery (TAT, WAT, SRT, Self Description).',
    getTestCards: (getMaterials) => [
      {
        id: 'piq',
        testTypeId: 'piq',
        shortCode: 'PIQ',
        title: 'Filling PIQ Form',
        description: 'Guidelines to fill the Personal Information Questionnaire without discrepancies.',
        materials: getMaterials('piq'),
      },
      {
        id: 'psych',
        testTypeId: 'tat',
        shortCode: 'PSYCH',
        title: 'Psychology Test Battery (TAT, WAT, SRT, SD)',
        description: 'Thematic Apperception (12 slides), Word Association (60 words), Situation Reaction (60 scenarios), and SD.',
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
    stageBadge: 'Stage II Outdoor & GTO',
    title: strings.studyMaterial.day3Title,
    subtitle: 'All 8 Group Testing Officer (GTO) indoor & outdoor obstacles and tasks.',
    getTestCards: (getMaterials) => [
      {
        id: 'gd',
        testTypeId: 'gd',
        shortCode: 'GD',
        title: '1. Group Discussion',
        description: 'Current affairs and defense topics group discussion techniques.',
        materials: getMaterials('gd'),
      },
      {
        id: 'gpe',
        testTypeId: 'gpe',
        shortCode: 'GPE',
        title: '2. Group Planning Exercise',
        description: 'Military map problem solving and group consensus planning.',
        materials: getMaterials('gpe'),
      },
      {
        id: 'pgt',
        testTypeId: 'pgt',
        shortCode: 'PGT',
        title: '3. Progressive Group Task',
        description: 'Structures, plank, rope, and load crossing methods across 4 obstacles.',
        materials: getMaterials('pgt'),
      },
      {
        id: 'hgt',
        testTypeId: 'hgt',
        shortCode: 'HGT',
        title: '4. Half Group Task',
        description: 'Group half-division outdoor structure assessment.',
        materials: getMaterials('hgt'),
      },
      {
        id: 'iot',
        testTypeId: 'iot',
        shortCode: 'IOT',
        title: '5. Individual Obstacles Test',
        description: '10 individual outdoor physical obstacles and scoring strategy.',
        materials: getMaterials('iot'),
      },
      {
        id: 'command_task',
        testTypeId: 'command_task',
        shortCode: 'CT',
        title: '6. Command Task',
        description: 'Subordinate selection and leader obstacle execution.',
        materials: getMaterials('command_task'),
      },
      {
        id: 'snake_race',
        testTypeId: 'snake_race',
        shortCode: 'GOR',
        title: '7. Snake Race / Group Obstacle Race',
        description: 'Group obstacle race carrying continuous load (snake).',
        materials: getMaterials('snake_race'),
      },
      {
        id: 'fgt',
        testTypeId: 'fgt',
        shortCode: 'FGT',
        title: '8. Final Group Task',
        description: 'Final single outdoor structure group task execution.',
        materials: getMaterials('fgt'),
      },
    ],
  },
  {
    dayNumber: '5',
    stageBadge: 'Stage II Final Board',
    title: strings.studyMaterial.day5Title,
    subtitle: 'Personal Interview dossier review, Board Conference protocol, and SMB medicals.',
    getTestCards: (getMaterials) => [
      {
        id: 'interview',
        testTypeId: 'interview',
        shortCode: 'IO',
        title: 'Personal Interview',
        description: 'Interviewing Officer (IO/President) questioning dossier preparation.',
        materials: getMaterials('interview'),
      },
      {
        id: 'conference',
        testTypeId: 'conference',
        shortCode: 'CONF',
        title: 'Board Conference & Medicals',
        description: 'Final Assessor Board Conference protocol and Special Medical Board standards.',
        materials: getMaterials('conference'),
      },
    ],
  },
];
