#!/usr/bin/env node

/**
 * Upload OIR questions to Firestore
 * 
 * Usage: node upload-oir-questions.js --commit
 *
 * Without --commit this command is a safe dry run and performs no Firebase access.
 * 
 * Prerequisites:
 * 1. Firebase Admin SDK initialized
 * 2. Service account key configured
 * 3. oir-questions.json file in same directory
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!process.argv.includes('--commit')) {
  console.log('🧪 DRY RUN (default) — no credentials, network, or writes.');
  console.log('   Re-run with --commit only after reviewing the input and metadata.');
  process.exit(0);
}

// Initialize Firebase Admin SDK
// NOTE: Update this path to your service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: Firebase service account key not found');
  console.error(`   Expected at: ${serviceAccountPath}`);
  console.error('   Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable or place key at ./serviceAccountKey.json');
  process.exit(1);
}

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Upload OIR questions to Firestore
 */
async function uploadOIRQuestions() {
  try {
    console.log('\n📚 Loading OIR questions from file...');
    
    // Read questions file
    const questionsPath = path.join(__dirname, 'oir-questions.json');
    if (!fs.existsSync(questionsPath)) {
      throw new Error('oir-questions.json not found in scripts directory');
    }
    
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    console.log(`   Loaded: ${questionsData.metadata.total_questions} questions`);
    console.log(`   Version: ${questionsData.metadata.version}`);
    console.log(`   Batches: ${questionsData.batches.length}`);
    
    // Upload metadata
    console.log('\n📝 Uploading metadata...');
    const metaRef = db.collection('test_content').doc('oir').collection('meta').doc('config');
    await metaRef.set({
      total_questions: questionsData.metadata.total_questions,
      version: questionsData.metadata.version,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
      batches: questionsData.batches.length,
      distribution: questionsData.metadata.distribution,
      description: questionsData.metadata.description || ''
    });
    console.log('   ✅ Metadata uploaded');
    
    // Upload each batch
    console.log('\n📦 Uploading question batches...');
    for (const batch of questionsData.batches) {
      console.log(`   Uploading ${batch.batch_id}...`);
      
      const batchRef = db.collection('test_content')
        .doc('oir')
        .collection('question_batches')
        .doc(batch.batch_id);
      
      await batchRef.set({
        batch_id: batch.batch_id,
        version: batch.version,
        question_count: batch.question_count,
        questions: batch.questions,
        uploaded_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`   ✅ ${batch.batch_id}: ${batch.question_count} questions uploaded`);
    }
    
    // Verify upload
    console.log('\n🔍 Verifying upload...');
    const batchesSnapshot = await db.collection('test_content')
      .doc('oir')
      .collection('question_batches')
      .get();
    
    let totalQuestionsVerified = 0;
    batchesSnapshot.forEach(doc => {
      const data = doc.data();
      totalQuestionsVerified += data.question_count;
    });
    
    console.log(`   Total batches in Firestore: ${batchesSnapshot.size}`);
    console.log(`   Total questions verified: ${totalQuestionsVerified}`);
    
    if (totalQuestionsVerified === questionsData.metadata.total_questions) {
      console.log('\n✅ SUCCESS! All questions uploaded and verified');
    } else {
      console.warn('\n⚠️  Warning: Question count mismatch');
      console.warn(`   Expected: ${questionsData.metadata.total_questions}`);
      console.warn(`   Found: ${totalQuestionsVerified}`);
    }
    
    // Display sample question
    console.log('\n📄 Sample question from Firestore:');
    const firstBatch = batchesSnapshot.docs[0].data();
    const sampleQuestion = firstBatch.questions[0];
    console.log(`   ID: ${sampleQuestion.id}`);
    console.log(`   Type: ${sampleQuestion.type}`);
    console.log(`   Question: ${sampleQuestion.questionText}`);

    console.log('\n🎉 Upload complete!');
    
  } catch (error) {
    console.error('\n❌ Error uploading questions:', error);
    throw error;
  }
}

/**
 * Delete existing OIR questions (use with caution!)
 */
async function deleteExistingQuestions() {
  console.log('\n🗑️  Deleting existing OIR questions...');
  
  const batchesSnapshot = await db.collection('test_content')
    .doc('oir')
    .collection('question_batches')
    .get();
  
  const deletePromises = [];
  batchesSnapshot.forEach(doc => {
    deletePromises.push(doc.ref.delete());
  });
  
  await Promise.all(deletePromises);
  console.log(`   Deleted ${batchesSnapshot.size} batches`);
  
  // Delete metadata
  await db.collection('test_content').doc('oir').collection('meta').doc('config').delete();
  console.log('   Deleted metadata');
}

// Command line handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📚 OIR Questions Firestore Upload Tool

Usage:
  node upload-oir-questions.js --commit

Options:
  --commit          Enable Firebase writes (dry run is the default)
  --delete-first    Delete existing questions before uploading (use with caution!)
  --help, -h        Show this help message

Examples:
  node upload-oir-questions.js --commit
  node upload-oir-questions.js --commit --delete-first

Environment Variables:
  FIREBASE_SERVICE_ACCOUNT_KEY   Path to Firebase service account key JSON file
  `);
  process.exit(0);
}

// Main execution
(async () => {
  try {
    if (args.includes('--delete-first')) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('\n⚠️  This will DELETE all existing OIR questions. Continue? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() === 'yes') {
        await deleteExistingQuestions();
      } else {
        console.log('❌ Aborted');
        process.exit(0);
      }
    }
    
    await uploadOIRQuestions();
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
})();

