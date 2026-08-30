const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../.firebase/service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Create GPE batch document from uploaded images
 */
async function createGPEBatch() {
    try {
        console.log('📤 Creating GPE batch document...\n');

        // Read upload results
        const resultsPath = path.join(__dirname, 'gpe-upload-results.json');
        if (!fs.existsSync(resultsPath)) {
            throw new Error('Upload results not found. Run upload-gpe-images.js first.');
        }

        const uploadedImages = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

        console.log(`📊 Creating batch with ${uploadedImages.length} images\n`);

        // Specific generated scenario
        const scenarioData = {
            scenario: `You are a group of 8 students from Government College, returning from a nature camp in the forest. You are currently at the 'Rest House' (marked on likely map). It is 1400 hrs. The last bus to the city leaves from the 'Bus Stop' at 1700 hrs, which is 15 km away.

While resting, a local villager rushes to you and informs:
1. A massive fire has broken out in the forest (North side) and is spreading towards the 'Tribal Settlement'. The villagers need immediate evacuation.
2. He saw a group of suspicious men planting explosives under the 'Railway Bridge' (as shown in map). A passenger train is due to pass in 45 minutes.
3. One of his friends has been bitten by a poisonous snake and is unconscious at the 'Old Temple' (East side).
4. Your own college van has a flat tire and the driver is missing.

Resources available:
- 1 Jeep (can carry 4 people, speed 40 kmph on road, 20 kmph on track)
- 1 Motorboat at the river bank (capacity 3, speed 15 kmph)
- A bundle of rope, a first aid kit, and 2 flashlights.
- No mobile network coverage.

Task:
Identify the problems, prioritize them, and produce a plan to handle all situations effectively and reach the Bus Stop by 1700 hrs to catch your bus.`,
            description: "Tactical map showing a river with a railway bridge, a forest area to the north, a tribal settlement, a temple to the east, and connecting roads.",
            resources: ["Jeep", "Motorboat", "Rope", "First Aid Kit", "Flashlights"],
            difficulty: "HARD"
        };

        // Create images array for batch
        const images = uploadedImages.map((img, index) => {
            return {
                id: `gpe_generated_${String(index + 1).padStart(3, '0')}`,
                imageUrl: img.publicUrl,
                imageStoragePath: img.storagePath,
                scenario: scenarioData.scenario,
                imageDescription: scenarioData.description,
                resources: scenarioData.resources,
                viewingTimeSeconds: 60,
                planningTimeSeconds: 1740, // 29 minutes
                minCharacters: 500,
                maxCharacters: 2000,
                category: "Tactical",
                difficulty: scenarioData.difficulty
            };
        });

        const batchData = {
            batch_id: "batch_001",
            version: "1.0.0",
            image_count: images.length,
            uploaded_at: admin.firestore.Timestamp.now(),
            description: "GPE tactical scenario images - Base batch",
            images: images
        };

        // Upload to Firestore
        const batchRef = db.doc('test_content/gpe/image_batches/batch_001');
        await batchRef.set(batchData);

        console.log('✅ Batch document created successfully!');

        // Update or create metadata
        const metaRef = db.doc('test_content/gpe/meta/overview');
        const metaDoc = await metaRef.get();

        if (metaDoc.exists) {
            const currentData = metaDoc.data();
            const updatedBatches = currentData.available_batches || [];
            if (!updatedBatches.includes('batch_001')) {
                updatedBatches.push('batch_001');
                updatedBatches.sort();
            }

            await metaRef.update({
                total_images: (currentData.total_images || 0) + images.length,
                available_batches: updatedBatches,
                last_updated: admin.firestore.Timestamp.now()
            });

            console.log('✅ Metadata updated!');
        } else {
            await metaRef.set({
                total_images: images.length,
                available_batches: ['batch_001'],
                last_updated: admin.firestore.Timestamp.now(),
                content_type: 'gpe_images'
            });

            console.log('✅ Metadata created!');
        }

        console.log('\n🎉 GPE batch creation complete!\n');
        console.log('📊 Summary:');
        console.log(`   ✅ ${images.length} images in batch`);
        console.log(`   ✅ Batch: batch_001`);
        console.log(`   ✅ Version: 1.0.0\n`);

        // Save batch data to JSON for reference
        const batchPath = path.join(__dirname, 'gpe-batch-001.json');
        fs.writeFileSync(batchPath, JSON.stringify(batchData, null, 2));
        console.log(`📝 Batch data saved to: ${batchPath}\n`);

    } catch (error) {
        console.error('❌ Batch creation failed:', error);
        throw error;
    }
}

// Run the batch creation
createGPEBatch()
    .then(() => {
        console.log('✨ Batch creation completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Batch creation failed:', error);
        process.exit(1);
    });
