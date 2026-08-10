import { StudyMaterial } from '../types/testContent';
import { strings } from './strings';

const guides = strings.studyMaterialGuides;

export const FALLBACK_STUDY_MATERIALS: StudyMaterial[] = [
  {
    id: 'ssb-overview-01',
    title: guides.overview.title,
    category: guides.overview.category,
    summary: guides.overview.summary,
    contentMarkdown: '# SSB 5-Day Process\n\n- **Day 1**: Screening (OIR & PPDT)\n- **Day 2**: Psychology Tests (TAT, WAT, SRT, SD)\n- **Day 3 & 4**: GTO Tasks & Personal Interview\n- **Day 5**: Conference',
    estimatedReadTimeMinutes: 6,
    tags: ['SSB', 'Screening', 'Overview'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '1',
    testTypeId: 'oir'
  },
  {
    id: 'fallback-oir',
    title: guides.oir.title,
    category: guides.oir.category,
    summary: guides.oir.summary,
    contentMarkdown: '# OIR Preparation Strategies\n\n- Solve verbal & non-verbal reasoning questions with high speed.\n- Focus on accuracy to secure OIR Rating 1.',
    estimatedReadTimeMinutes: 5,
    tags: ['OIR', 'Reasoning', 'Screening'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '1',
    testTypeId: 'oir'
  },
  {
    id: 'fallback-ppdt',
    title: guides.ppdt.title,
    category: guides.ppdt.category,
    summary: guides.ppdt.summary,
    contentMarkdown: '# PPDT Guide\n\n- Observe character mood, age, and background in 30 seconds.\n- Write a positive action-oriented story in 4 minutes.',
    estimatedReadTimeMinutes: 5,
    tags: ['PPDT', 'Perception', 'Screening'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '1',
    testTypeId: 'ppdt'
  },
  {
    id: 'fallback-piq',
    title: guides.piq.title,
    category: guides.piq.category,
    summary: guides.piq.summary,
    contentMarkdown: '# PIQ Guide\n\n- Ensure exact match between PIQ entries and your responses.\n- Avoid any discrepancy in marks, hobbies, or achievements.',
    estimatedReadTimeMinutes: 6,
    tags: ['PIQ', 'Personal History', 'Interview'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '2',
    testTypeId: 'piq'
  },
  {
    id: 'fallback-tat',
    title: guides.tat.title,
    category: guides.tat.category,
    summary: guides.tat.summary,
    contentMarkdown: '# TAT Guide\n\n- Write 12 stories based on picture stimuli.\n- Highlight officer-like qualities without artificial templates.',
    estimatedReadTimeMinutes: 7,
    tags: ['TAT', 'Psychology', 'Stories'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '2',
    testTypeId: 'tat'
  },
  {
    id: 'fallback-wat',
    title: guides.wat.title,
    category: guides.wat.category,
    summary: guides.wat.summary,
    contentMarkdown: '# WAT Guide\n\n- Formulate short, meaningful, and constructive responses.\n- Avoid pre-memorized slogans.',
    estimatedReadTimeMinutes: 5,
    tags: ['WAT', 'Word Association', 'Psychology'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '2',
    testTypeId: 'wat'
  },
  {
    id: 'fallback-srt',
    title: guides.srt.title,
    category: guides.srt.category,
    summary: guides.srt.summary,
    contentMarkdown: '# SRT Guide\n\n- Provide practical, swift, and complete solutions.\n- Address the immediate problem first before secondary steps.',
    estimatedReadTimeMinutes: 6,
    tags: ['SRT', 'Situation Reaction', 'Psychology'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '2',
    testTypeId: 'srt'
  },
  {
    id: 'fallback-sd',
    title: guides.sd.title,
    category: guides.sd.category,
    summary: guides.sd.summary,
    contentMarkdown: '# Self Description (SD) Guide\n\n- Write honest perspectives from parents, teachers, friends, and self.\n- Show genuine self-awareness and improvement plan.',
    estimatedReadTimeMinutes: 5,
    tags: ['SD', 'Self Description', 'Psychology'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '2',
    testTypeId: 'sd'
  },
  {
    id: 'fallback-gd',
    title: guides.gd.title,
    category: guides.gd.category,
    summary: guides.gd.summary,
    contentMarkdown: '# Group Discussion Guide\n\n- Present structured arguments backed by defense facts.\n- Encourage group participation and listen actively.',
    estimatedReadTimeMinutes: 5,
    tags: ['GD', 'Group Discussion', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'gd'
  },
  {
    id: 'fallback-gpe',
    title: guides.gpe.title,
    category: guides.gpe.category,
    summary: guides.gpe.summary,
    contentMarkdown: '# Group Planning Exercise Guide\n\n- Calculate travel times and resource allocation systematically.\n- Work towards group consensus during discussion.',
    estimatedReadTimeMinutes: 6,
    tags: ['GPE', 'Group Planning', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'gpe'
  },
  {
    id: 'fallback-pgt',
    title: guides.pgt.title,
    category: guides.pgt.category,
    summary: guides.pgt.summary,
    contentMarkdown: '# Progressive Group Task Guide\n\n- Understand fulcrum, cantilever, and load-bearing structures.\n- Adhere strictly to GTO color rules.',
    estimatedReadTimeMinutes: 6,
    tags: ['PGT', 'Outdoor Tasks', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'pgt'
  },
  {
    id: 'fallback-hgt',
    title: guides.hgt.title,
    category: guides.hgt.category,
    summary: guides.hgt.summary,
    contentMarkdown: '# Half Group Task Guide\n\n- Take active initiative when group size is reduced.\n- Maintain high team coordination.',
    estimatedReadTimeMinutes: 5,
    tags: ['HGT', 'Half Group', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'hgt'
  },
  {
    id: 'fallback-iot',
    title: guides.iot.title,
    category: guides.iot.category,
    summary: guides.iot.summary,
    contentMarkdown: '# Individual Obstacles Guide\n\n- Sequence high-scoring obstacles first.\n- Maintain steady pace and safety.',
    estimatedReadTimeMinutes: 5,
    tags: ['IOT', 'Individual Obstacles', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'iot'
  },
  {
    id: 'fallback-command_task',
    title: guides.command_task.title,
    category: guides.command_task.category,
    summary: guides.command_task.summary,
    contentMarkdown: '# Command Task Guide\n\n- Select subordinates based on skill and load requirement.\n- Give clear instructions as Commander.',
    estimatedReadTimeMinutes: 6,
    tags: ['Command Task', 'Leadership', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'command_task'
  },
  {
    id: 'fallback-snake_race',
    title: guides.snake_race.title,
    category: guides.snake_race.category,
    summary: guides.snake_race.summary,
    contentMarkdown: '# Snake Race Guide\n\n- Hold tent load together with group war cries.\n- Ensure no teammate is left behind.',
    estimatedReadTimeMinutes: 5,
    tags: ['Snake Race', 'GOR', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'snake_race'
  },
  {
    id: 'fallback-fgt',
    title: guides.fgt.title,
    category: guides.fgt.category,
    summary: guides.fgt.summary,
    contentMarkdown: '# Final Group Task Guide\n\n- Apply learning from PGT/HGT to solve the final structure rapidly.',
    estimatedReadTimeMinutes: 5,
    tags: ['FGT', 'Final Group', 'GTO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '3-4',
    testTypeId: 'fgt'
  },
  {
    id: 'fallback-interview',
    title: guides.interview.title,
    category: guides.interview.category,
    summary: guides.interview.summary,
    contentMarkdown: '# Personal Interview Guide\n\n- Align responses with PIQ entry details.\n- Demonstrate honesty, defense awareness, and poise.',
    estimatedReadTimeMinutes: 7,
    tags: ['Interview', 'Personal Interview', 'IO'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '5',
    testTypeId: 'interview'
  },
  {
    id: 'fallback-conference',
    title: guides.conference.title,
    category: guides.conference.category,
    summary: guides.conference.summary,
    contentMarkdown: '# Board Conference Guide\n\n- Answer assessor questions clearly with high confidence.\n- Maintain upright posture and positive attitude.',
    estimatedReadTimeMinutes: 5,
    tags: ['Conference', 'Board Conference', 'Final Day'],
    createdAt: '2026-01-01T00:00:00Z',
    dayNumber: '5',
    testTypeId: 'conference'
  }
];

export function getFallbackStudyMaterials(): StudyMaterial[] {
  return FALLBACK_STUDY_MATERIALS;
}

export function getFallbackStudyMaterialById(id: string): StudyMaterial | null {
  const item = FALLBACK_STUDY_MATERIALS.find((m) => m.id === id);
  return item || null;
}
