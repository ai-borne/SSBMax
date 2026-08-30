#!/usr/bin/env node

/**
 * Upload TAT images to Firebase Storage
 * Uploads 57 images + blank_slide.jpg to tat_images/batch_001/
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { uploadImageAndGetUrl } = require('./lib/firebaseImageUpload');

// Initialize Firebase Admin
const serviceAccount = require('../.firebase/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ssbmax-49e68.firebasestorage.app'
});

const bucket = admin.storage().bucket();

// Configuration
const IMAGES_DIR = '/Users/sunil/Downloads/TAT_images';
const STORAGE_PATH = 'tat_images/batch_001';

async function uploadImage(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return { success: false, filename };
  }

  try {
    const destination = `${STORAGE_PATH}/${filename}`;

    const { imageUrl, storagePath } = await uploadImageAndGetUrl(bucket, filePath, destination, 'image/jpeg');

    console.log(`✅ Uploaded: ${filename}`);
    return { success: true, filename, url: imageUrl, storagePath };
  } catch (error) {
    console.error(`❌ Failed to upload ${filename}:`, error.message);
    return { success: false, filename, error: error.message };
  }
}

async function uploadAllImages() {
  console.log('📤 Starting TAT Image Upload to Firebase Storage\n');
  console.log(`Source: ${IMAGES_DIR}`);
  console.log(`Destination: gs://${bucket.name}/${STORAGE_PATH}\n`);

  // Check if directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ Directory not found: ${IMAGES_DIR}`);
    console.error('Please ensure TAT images are in the correct directory.\n');
    process.exit(1);
  }

  const results = {
    successful: [],
    failed: []
  };

  // Upload 57 numbered images
  console.log('📸 Uploading numbered images (tat_001.jpg to tat_0057.jpg)...\n');
  
  for (let i = 1; i <= 57; i++) {
    // Handle naming: tat_001 to tat_009, then tat_0010 to tat_0057
    const paddedNum = i <= 9 ? String(i).padStart(3, '0') : String(i).padStart(4, '0');
    const filename = `tat_${paddedNum}.jpg`;
    
    const result = await uploadImage(filename);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Upload blank slide
  console.log('\n🎨 Uploading blank slide...\n');
  const blankResult = await uploadImage('blank_slide.jpg');
  
  if (blankResult.success) {
    results.successful.push(blankResult);
  } else {
    results.failed.push(blankResult);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully uploaded: ${results.successful.length} images`);
  console.log(`❌ Failed to upload: ${results.failed.length} images`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    results.failed.forEach(item => {
      console.log(`   - ${item.filename}: ${item.error || 'File not found'}`);
    });
  }

  console.log('\n📝 Next Steps:');
  console.log('1. Verify images in Firebase Console:');
  console.log('   https://console.firebase.google.com/project/ssbmax-49e68/storage');
  console.log('2. Run: node scripts/create_tat_firestore_metadata.js');
  console.log('3. Run: node scripts/update_tat_urls.js\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run the upload
uploadAllImages().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

