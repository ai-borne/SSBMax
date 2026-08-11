import { BatchDocument, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch } from '../types/testContent';

export function getFallbackOIRBatch(batchIndex = 0): BatchDocument<OIRQuestion> {
  return {
    id: `batch_pdf_${String(batchIndex + 1).padStart(3, '0')}`,
    batchIndex,
    totalItems: 5,
    items: [
      {
        id: 'oir-f-1',
        questionNumber: 1,
        questionText: 'If LIGHT is coded as MJHIU, how is FRAME coded?',
        options: ['GSBNS', 'GSBNF', 'HSBNF', 'GSAMF'],
        type: 'VERBAL'
      },
      {
        id: 'oir-f-2',
        questionNumber: 2,
        questionText: 'Find the odd one out among the numbers: 27, 64, 125, 144, 216',
        options: ['27', '64', '144', '216'],
        type: 'VERBAL'
      },
      {
        id: 'oir-f-3',
        questionNumber: 3,
        questionText: 'Complete the series: 3, 7, 15, 31, 63, ?',
        options: ['95', '115', '127', '131'],
        type: 'VERBAL'
      },
      {
        id: 'oir-f-4',
        questionNumber: 4,
        questionText: 'Pointing to a photograph, a officer said, "He is the son of the only daughter of my father." How is the officer related to the person?',
        options: ['Brother', 'Father', 'Uncle', 'Grandfather'],
        type: 'VERBAL'
      },
      {
        id: 'oir-f-5',
        questionNumber: 5,
        questionText: 'If + means ÷, ÷ means ×, × means -, and - means +, then 16 ÷ 4 + 2 × 5 - 3 = ?',
        options: ['26', '30', '32', '35'],
        type: 'VERBAL'
      }
    ]
  };
}

export function getFallbackPPDTContext(id = 'ppdt_1'): PPDTContext {
  return {
    id,
    title: 'Stage I PPDT Picture Stimulus',
    imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80',
    viewingTimeSeconds: 30,
    writingTimeSeconds: 240,
    instructions: [
      'Observe the picture for 30 seconds.',
      'Identify number of characters, age, gender, and mood.',
      'Write a constructive, action-oriented story in 4 minutes.'
    ]
  };
}

export function getFallbackTATSet(id = 'tat_set_1'): TATSet {
  return {
    id,
    setName: 'TAT Standard 12-Picture Set',
    imageUrls: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80'
    ],
    slideDurationSeconds: 240,
    totalSlides: 3
  };
}

export function getFallbackWATBatch(id = 'wat_batch_1'): WATBatch {
  return {
    id,
    words: [
      'COURAGE', 'DUTY', 'DISCIPLINE', 'INITIATIVE', 'LEADERSHIP',
      'FAILURE', 'TEMPER', 'COMPASSION', 'TIMIDITY', 'COUNTRY'
    ],
    displayDurationSeconds: 15
  };
}

export function getFallbackSRTBatch(id = 'srt_batch_1'): SRTBatch {
  return {
    id,
    situations: [
      'While travelling in a train at night, he hears a loud cry for help from the adjacent compartment. He...',
      'He was appointed leader of a team with uncooperative members just 2 days before a project deadline. He...',
      'While going to take an important examination, he sees an injured person lying bleeding on the road. He...',
      'His team commander fell injured during an outdoor exercise mission. He...',
      'During a village relief drive, a sudden thunderstorm broke out. He...'
    ],
    totalTimeMinutes: 30
  };
}
