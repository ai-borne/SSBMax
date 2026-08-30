#!/usr/bin/env node

/**
 * Create Firestore metadata for TAT images
 * Creates document at test_content/tat/image_batches/batch_001
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../.firebase/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createMetadata() {
  console.log('📝 Creating TAT Firestore metadata...\n');

  try {
    // Generate metadata for 57 images + blank_slide
    const images = [];

    // Add 57 numbered images (matching file naming: tat_001 to tat_009, tat_0010 to tat_0057)
    for (let i = 1; i <= 57; i++) {
      const paddedNum = i <= 9 ? String(i).padStart(3, '0') : String(i).padStart(4, '0');
      images.push({
        id: `tat_${paddedNum}`,
        imageUrl: `https://via.placeholder.com/800x600/3498db/ffffff?text=TAT+${i}`, // Placeholder, will be updated
        storagePath: null, // Filled in by update_tat_urls.js
        sequenceNumber: i,
        prompt: 'Write a story about what you see in the picture',
        viewingTimeSeconds: 30,
        writingTimeMinutes: 4,
        minCharacters: 150,
        maxCharacters: 800,
        category: null,
        difficulty: 'medium'
      });
    }

    // Add blank slide as 58th image (special handling - shown as 12th in random selection)
    images.push({
      id: 'blank_slide',
      imageUrl: 'https://via.placeholder.com/800x600/FFFFFF/000000?text=Blank+Slide', // Placeholder
      storagePath: null, // Filled in by update_tat_urls.js
      sequenceNumber: 58,
      prompt: 'Describe what you imagine in your mind',
      viewingTimeSeconds: 30,
      writingTimeMinutes: 4,
      minCharacters: 150,
      maxCharacters: 800,
      category: 'imagination',
      difficulty: 'hard'
    });

    const batch001 = {
      batchId: 'batch_001',
      version: '1.0.0',
      totalImages: 58, // 57 + 1 blank slide
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      images: images
    };

    // Write to Firestore
    const docRef = db.doc('test_content/tat/image_batches/batch_001');
    await docRef.set(batch001);

    console.log('✅ Firestore metadata created successfully!');
    console.log(`   Path: test_content/tat/image_batches/batch_001`);
    console.log(`   Total images: ${images.length} (57 + blank_slide)`);
    console.log('\n📝 Image structure:');
    console.log(`   - tat_001 to tat_057: Regular TAT images`);
    console.log(`   - blank_slide: Special blank image for imagination test`);
    
    console.log('\n📝 Next: Run update_tat_urls.js to replace placeholders with real URLs\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating metadata:', error);
    process.exit(1);
  }
}

// Run
createMetadata();

