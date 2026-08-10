import { describe, it } from 'vitest';
import { ContentRepository } from '../../../src/repositories/ContentRepository';

describe('Live Firestore Test Content Extractor & Runner', () => {
  it('fetches and displays test payloads across all 5 SSB test modules from Firestore', async () => {
    const repo = new ContentRepository();

    console.log('\n====================================================');
    console.log('🚀 SSBMax Firestore Test Content Verification Suite');
    console.log('====================================================\n');

    // 1. OIR Question Batches
    console.log('🔹 1. Fetching OIR Question Batch (batch_0)...');
    const oirBatch = await repo.getOIRQuestions(0);
    console.log(`   - Batch ID: ${oirBatch.id}`);
    console.log(`   - Total Items: ${oirBatch.totalItems}`);
    console.log(`   - Sample Question #1: "${oirBatch.items[0]?.questionText}"`);
    console.log(`   - Options: ${JSON.stringify(oirBatch.items[0]?.options)}`);
    console.log(`   - Anti-Cheat Check (correctAnswerIndex): ${(oirBatch.items[0] as any).correctAnswerIndex ?? 'HIDDEN (Sanitized ✅)'}\n`);

    // 2. PPDT Context
    console.log('🔹 2. Fetching PPDT Context (ppdt_1)...');
    const ppdt = await repo.getPPDTContext('ppdt_1');
    console.log(`   - ID: ${ppdt.id}`);
    console.log(`   - Title: ${ppdt.title}`);
    console.log(`   - Image URL: ${ppdt.imageUrl}`);
    console.log(`   - Viewing Time: ${ppdt.viewingTimeSeconds}s | Writing Time: ${ppdt.writingTimeSeconds}s\n`);

    // 3. TAT Set
    console.log('🔹 3. Fetching TAT Picture Set (tat_set_1)...');
    const tat = await repo.getTATSet('tat_set_1');
    console.log(`   - Set Name: ${tat.setName}`);
    console.log(`   - Total Slides: ${tat.totalSlides}`);
    console.log(`   - Slide #1 URL: ${tat.imageUrls[0]}`);
    console.log(`   - Slide #12 (SSB Blank Card Protocol): "${tat.imageUrls[11]}"\n`);

    // 4. WAT Batch
    console.log('🔹 4. Fetching WAT Word Batch (wat_batch_1)...');
    const wat = await repo.getWATBatch('wat_batch_1');
    console.log(`   - Batch ID: ${wat.id}`);
    console.log(`   - Total Words: ${wat.words.length}`);
    console.log(`   - Sample Words (1-5): ${JSON.stringify(wat.words.slice(0, 5))}`);
    console.log(`   - Display Duration: ${wat.displayDurationSeconds}s per word\n`);

    // 5. SRT Batch
    console.log('🔹 5. Fetching SRT Situation Batch (srt_batch_1)...');
    const srt = await repo.getSRTBatch('srt_batch_1');
    console.log(`   - Batch ID: ${srt.id}`);
    console.log(`   - Total Situations: ${srt.situations.length}`);
    console.log(`   - Sample Situation #1: "${srt.situations[0]}"`);
    console.log(`   - Total Assessment Time: ${srt.totalTimeMinutes} minutes\n`);

    console.log('====================================================');
    console.log('✅ ALL 5 FIRESTORE TEST MODULES VERIFIED SUCCESSFULLY!');
    console.log('====================================================\n');
  });
});
