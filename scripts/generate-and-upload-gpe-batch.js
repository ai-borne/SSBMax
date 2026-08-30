const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { uploadImageAndGetUrl } = require('./lib/firebaseImageUpload');

// Service Account
const serviceAccount = require('../.firebase/service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bucket = admin.storage().bucket('ssbmax-49e68.firebasestorage.app');

// Local paths to generated images (UPDATE THESE WITH ACTUAL FILENAMES)
const MAPS = [
    { type: 'river', path: '/Users/sunil/.gemini/antigravity/brain/fc7789c2-dea3-4ab6-ac9d-2171f5a718a9/gpe_map_river_village_1765722775813.png', description: "Topographical map with river, bridge, temple, and forest." },
    { type: 'hilly', path: '/Users/sunil/.gemini/antigravity/brain/fc7789c2-dea3-4ab6-ac9d-2171f5a718a9/gpe_map_hilly_railway_1765722794532.png', description: "Hilly terrain map with railway line, station, lake, and tea garden." },
    { type: 'coastal', path: '/Users/sunil/.gemini/antigravity/brain/fc7789c2-dea3-4ab6-ac9d-2171f5a718a9/gpe_map_coastal_fort_1765722817657.png', description: "Coastal map with lighthouse, beach, cliffs, and old fort." },
    { type: 'desert', path: '/Users/sunil/.gemini/antigravity/brain/fc7789c2-dea3-4ab6-ac9d-2171f5a718a9/gpe_map_desert_oasis_1765722853062.png', description: "Desert map with sand dunes, oasis, settlement, and rocky outcrop." }
];

// Scenarios Generator
function getScenariosForMap(mapType, mapUrl) {
    const common = {
        viewingTimeSeconds: 60,
        planningTimeSeconds: 1740,
        minCharacters: 500,
        maxCharacters: 2000,
        difficulty: "HARD"
    };

    switch (mapType) {
        case 'river':
            return [
                {
                    ...common,
                    scenario: "You are a group of students camping near the temple. A villager informs you: 1. A flash flood is expected in 1 hour due to heavy rain upstream. 2. The bridge supports are weak and might collapse under the incoming bus carrying school children. 3. A fisherman is stranded on a small island in the river. 4. A fire broke out in the forest threatening the village. You have a jeep, a weak mobile signal at the temple top, and ropes.",
                    solution: "Priority 1: Warn the bus (prevent mass casualty). Send 2 runners to stop the bus before the bridge. Priority 2: Save the fisherman. Use ropes and local boat (if found) or swim if safe (trained swimmers). Priority 3: Evacuate village/Alert about flood. Use temple loudspeaker or runners. Priority 4: Fire. Create fire break using village inputs. Plan: Divide into 3 groups. G1 (2 ppl) run to bridge to stop bus. G2 (4 ppl) evacuate village and help fisherman. G3 (2 ppl) manage fire/coordination. Meet at safe high ground near temple.",
                    title: "River Flash Flood"
                },
                {
                    ...common,
                    scenario: "While visiting the temple, you see: 1. A gang of smugglers loading sandalwood from the forest onto a truck. 2. The priest has suffered a heart attack and needs immediate aid. 3. A child has fallen into the river near the bridge. 4. Your own vehicle has run out of fuel. You have a first aid kit and a cycle found near the temple.",
                    solution: "Priority 1: Child in river. Immediate rescue by swimmers. Priority 2: Priest. First aid (CPR), send cyclist to village for doctor/vehicle. Priority 3: Smugglers. Do not confront directly. Note details, inform police via village phone. Plan: 1 diver rescue child. 2 members attend to priest. 1 cyclist rides to village for help and police. Others create diversion/observe smugglers from safe distance.",
                    title: "Temple Emergency"
                },
                {
                    ...common,
                    scenario: "Returning from a picnic in the forest: 1. You spot a broken rail track on the bridge (train due in 30 mins). 2. A tiger has strayed into the village causing panic. 3. Two of your friends are missing in the forest. 4. A boat has capsized in the river. You have flares and a whistle.",
                    solution: "Priority 1: Broken Rail. Stop the train. Run along track with red cloth/shirt. Priority 2: Capsized boat. Rescue survivors. Priority 3: Tiger. Warn villagers to stay indoors, use flares to scare if needed. Priority 4: Missing friends. Search party. Plan: G1 (2) runs to stop train. G2 (3) rescues boat victims. G3 (3) helps village/search friends. Rendezvous at Bridge.",
                    title: "Broken Rail & Tiger"
                },
                {
                    ...common,
                    scenario: "Army exercise scenario: 1. Enemy paratroopers spotted landing in the forest (East). 2. Bridge is mined (intelligence report). 3. Supply truck convoy ambush expected near village. 4. Communications jammed. You are a patrol of 8 soldiers with standard weapons and radio (jammed).",
                    solution: "Priority 1: Warn convoy/Stop ambush. Send runner/vehicle to intercept. Priority 2: Secure Bridge. diffuse mines or guard it. Priority 3: Neutralize paratroopers. Locate and engage/contain. Plan: Split force. Fire team A secures bridge. Fire team B moves to village to warn convoy. Fire team C scouts forest edge. Use runners for comms.",
                    title: "Enemy Infiltration"
                },
                {
                    ...common,
                    scenario: "Village fair near the temple: 1. A stampede starts due to a rumor. 2. A firecracker shop catches fire. 3. A thief snatched a gold chain and ran towards the bridge. 4. An elderly woman fainted in the crowd. Resources: Public address system, water buckets.",
                    solution: "Priority 1: Stampede/Crowd Control. Use PA system to calm fluid. Priority 2: Fire. Form bucket chain, evacuate area. Priority 3: Medical aid to woman. Priority 4: Thief. Send fit members to chase. Plan: 2 members on PA system for crowd control. 3 members fight fire. 2 members attend woman. 1 chases thief.",
                    title: "Village Fair Chaos"
                }
            ];
        case 'hilly':
            return [
                {
                    ...common,
                    scenario: "At the hill station: 1. A landslide has blocked the railway track (Express train due). 2. A cable car is stuck mid-air with tourists. 3. A forest fire is approaching the tea garden workers' quarters. 4. A terrorist is hiding in the railway station waiting for a contact. You are a group of NCC cadets.",
                    solution: "Priority 1: Train safety. Signal train to stop (red flag/burning cloth). Priority 2: Forest Fire/Workers. Evacuate workers, alert fire station. Priority 3: Cable car. Alert authorities, calm tourists. Priority 4: Terrorist. Inform police discreetly. Plan: Split into sub-groups. G1 to track. G2 to tea garden. G3 to station master/police.",
                    title: "Hill Station Crisis"
                },
                {
                    ...common,
                    scenario: "Trekking expedition: 1. One trekker fell into a ravine and has a broken leg. 2. Heavy fog is descending, visibility dropping. 3. You hear gunshots from the tea garden (possible poaching). 4. The only bridge to the station is damaged by rain. Resources: Ropes, medical kit, walking sticks.",
                    solution: "Priority 1: Injured trekker. Stabilize, lift using ropes. Priority 2: Shelter from fog/weather. Priority 3: Poachers. Report to forest guards when possible. Plan: All hands to rescue injured trekker first before visibility drops zero. Move to station/shelter. Inform authorities about bridge and poachers.",
                    title: "Trekking Accident"
                },
                {
                    ...common,
                    scenario: "Tea Garden Inspection: 1. Workers are agitating and turning violent at the office. 2. A dam upstream (near lake) shows cracks. 3. A leopard is trapped in a pit nearby. 4. A VIP helicopter is landing at the helipad in 20 mins (unsafe due to agitation).",
                    solution: "Priority 1: Dam/Flood warning. Verify and warn downstream. Priority 2: VIP Safety. Cancel landing or secure helipad. Priority 3: Leopard. Inform wildlife dept. Priority 4: Agitation. Pacify or call police. Plan: Inform authorities about Dam. Send signal/radio to divert Helicopter. Police for agitation. Forest dept for leopard.",
                    title: "Tea Garden Unrest"
                },
                {
                    ...common,
                    scenario: "Railway Station Scenario: 1. A bomb threat call for the station. 2. A goods train derailed near the lake leaking toxic gas. 3. A group of tourists is lost on the hill track. 4. Storm approaching. Resources: Station master's office, phone.",
                    solution: "Priority 1: Toxic Gas. Evacuate area downwind. Stop trains. Priority 2: Bomb threat. Evacuate station, call bomb squad. Priority 3: Lost tourists. Send search party/announce. Plan: Total evacuation of station and affected area. Coordinate with disaster management.",
                    title: "Station Disaster"
                },
                {
                    ...common,
                    scenario: "NCC Camp near Lake: 1. Food poisoning outbreak in camp. 2. A forest fire blocks the road to hospital. 3. A drowning case in the lake. 4. Radio equipment is malfunctioning. Resources: 1 Truck, 1 Boat.",
                    solution: "Priority 1: Drowning. Immediate rescue (boat/swimmers). Priority 2: Food poisoning. First aid, hydration. Priority 3: Transport. Clear road or use alternate route/boat to transport severe cases. Plan: Swimmers rescue drowning person. Drivers/others clear road or load truck. Medics tend to sick.",
                    title: "NCC Camp Emergency"
                }
            ];
        case 'coastal':
            return [
                {
                    ...common,
                    scenario: "Coastal Guard Patrol: 1. A smuggle boat is landing at the rocky cliffs. 2. A cyclone warning is issued (landfall in 2 hours). 3. The lighthouse lamp has failed (ships nearby). 4. A fisherman's hut is on fire near the beach.",
                    solution: "Priority 1: Lighthouse. Restore light/use emergency flares to warn ships. Priority 2: Fire. Extinguish and save residents. Priority 3: Cyclone. Evacuate village to Fort (high ground). Priority 4: Smugglers. Report to HQ, observe. Plan: G1 to Lighthouse. G2 to Fire. G3 initiate evacuation. Cmdr reports to HQ.",
                    title: "Cyclone & Smugglers"
                },
                {
                    ...common,
                    scenario: "Beach Holiday: 1. A child is swept away by a rip current. 2. You spot a shark fin near the swimming zone. 3. The old fort wall collapsed trapping a tourist. 4. A car accident on the coastal road. Resources: Surfboard, rope, mobile (low battery).",
                    solution: "Priority 1: Drowning child/Shark. Use surfboard for rescue, warn others to exit water. Priority 2: Car accident. First aid, call ambulance. Priority 3: Fort collapse. Rescue tourist. Plan: Swimmer with surfboard for child. 2 members to car accident. Remainder to fort to help tourist.",
                    title: "Beach Rescue"
                },
                {
                    ...common,
                    scenario: "Fort Visit: 1. Unexploded ordinance (UXO) found near Fort entrance. 2. A tourist fell off the cliff. 3. A boat is signaling distress at sea. 4. The road to the village is flooded by high tide. Resources: Binoculars, rope.",
                    solution: "Priority 1: Tourist off cliff. Secure with rope, first aid. Priority 2: Boat distress. Signal back, inform coast guard. Priority 3: UXO. Cordon off area, do not touch. Plan: Rope team rescues cliff victim. Observer signals boat/calls help. Sentries guard UXO.",
                    title: "Fort Accident"
                },
                {
                    ...common,
                    scenario: "Fishing Village: 1. An oil spill is washing ashore affecting nets/fish. 2. A cholera outbreak in the village. 3. A drug deal suspected at the lighthouse. 4. Generator failure at the clinic (vaccines spoiling).",
                    solution: "Priority 1: Clinic Generator. Fix or transport vaccines to cold storage. Priority 2: Cholera. Quarantine/Medical aid. Priority 3: Oil spill. Containment booms (local make). Priority 4: Drug deal. Police info. Plan: Tech guys fix generator. Medics handle outbreak. Villagers/others help with oil spill.",
                    title: "Village Crisis"
                },
                {
                    ...common,
                    scenario: "Lighthouse Inspection: 1. Keeper is missing. 2. Light malfunction. 3. A ship is heading for the rocks in fog. 4. You find a stash of illegal arms in the basement. Resources: Flare gun, radio.",
                    solution: "Priority 1: Ship safety. Fire flares, warn ship via radio. Priority 2: Arms. Do not touch, secure area. Priority 3: Keeper. Search premises. Plan: Use radio/flares immediately for ship. Secure arms room. Search for keeper.",
                    title: "Lighthouse Mystery"
                }
            ];
        case 'desert':
            return [
                {
                    ...common,
                    scenario: "Desert Safari: 1. Jeep radiator burst, water leaking. 2. Sandstorm approaching (15 mins). 3. A camel rider is injured near the rocky outcrop. 4. Your GPS is malfunctioning. Resources: 5L water, tent, compass.",
                    solution: "Priority 1: Sandstorm. Set up shelter/tent near rocky outcrop for cover. Priority 2: Water. Conserve leaking water immediately. Priority 3: Injured rider. Bring to shelter, first aid. Plan: Secure water. Move to outcrop. Set up tent. Drag injured rider to safety. Wait out storm.",
                    title: "Sandstorm Survival"
                },
                {
                    ...common,
                    scenario: "Border Outpost (Desert): 1. Infiltrators tracks seen crossing border. 2. Water supply tanker broke down 10km away. 3. A village hut is on fire. 4. Snake bite case in the unit. Resources: Radio, 1 Gypsy vehicle.",
                    solution: "Priority 1: Snake bite. Evacuate to hospital in Gypsy. Priority 2: Fire. Send men to help. Priority 3: Infiltrators. Report to HQ, follow tracks. Priority 4: Water. Send mechanic later. Plan: Gypsy takes snake bite victim + mechanic. Drop mechanic at tanker. Patrol follows tracks. Section helps village fire.",
                    title: "Border Protocol"
                },
                {
                    ...common,
                    scenario: "Oasis Stopover: 1. Water source poisoned (suspected). 2. A tourist is dehydrated and delirious. 3. A camel has broken loose with supplies. 4. Quick sand area identified on path. Resources: Med kit, rope.",
                    solution: "Priority 1: Dehydrated tourist. Rehydrate (oral), shade. Priority 2: Poisoned water. Mark area, warn everyone. Priority 3: Camel. Chase and retrieve using rope. Plan: Medic attends tourist. 2 men retrieve camel. 1 man marks quicksand and water source.",
                    title: "Oasis Danger"
                },
                {
                    ...common,
                    scenario: "Archaeological Dig (Rocky Outcrop): 1. Cave in trapping 2 workers. 2. Scorpion sting case. 3. Flash flood in the dry river bed (Wadi) expected. 4. Artifact theft attempt spotted. Resources: Shovels, satellite phone.",
                    solution: "Priority 1: Cave in. Dig out workers carefully. Priority 2: Scorpion sting. First aid. Priority 3: Flood. Move camp to high ground. Priority 4: Theft. Report. Plan: Digging team rescues workers. Medic treats sting. Logistics team moves camp up.",
                    title: "Excavation Rescue"
                } // 4 scenarios for desert is enough (Total 5+5+5+4 = 19)
            ];
        default:
            return [];
    }
}

async function main() {
    try {
        console.log('🚀 Starting GPE Batch Generation & Upload...');

        const mapUploads = [];

        // 1. Upload Images
        for (const map of MAPS) {
            console.log(`\n📤 Uploading map: ${map.type} (${path.basename(map.path)})`);

            if (!fs.existsSync(map.path)) {
                throw new Error(`File not found: ${map.path}`);
            }

            const fileName = `gpe_map_${map.type}_${Date.now()}.png`;
            const destination = `gpe_images/batch_002/${fileName}`;

            const { imageUrl, storagePath } = await uploadImageAndGetUrl(bucket, map.path, destination, 'image/png');

            console.log(`   ✅ Uploaded: ${imageUrl}`);

            mapUploads.push({
                type: map.type,
                url: imageUrl,
                storagePath,
                desc: map.description
            });
        }

        // 2. Generate Scenarios
        console.log('\n🧠 Generating 19 Scenarios...');
        const imagesList = [];
        var globalIndex = 0;

        for (const map of mapUploads) {
            const scenarios = getScenariosForMap(map.type, map.url);

            for (const s of scenarios) {
                globalIndex++;
                const id = `gpe_b2_${String(globalIndex).padStart(3, '0')}`;

                imagesList.push({
                    id: id,
                    imageUrl: map.url,
                    imageStoragePath: map.storagePath,
                    scenario: s.scenario,
                    solution: s.solution, // NEW FIELD
                    title: s.title,
                    imageDescription: map.desc,
                    resources: s.resources || ["Standard Kit"],
                    viewingTimeSeconds: s.viewingTimeSeconds,
                    planningTimeSeconds: s.planningTimeSeconds,
                    minCharacters: s.minCharacters,
                    maxCharacters: s.maxCharacters,
                    category: "Tactical",
                    difficulty: s.difficulty,
                    mapType: map.type
                });
            }
        }

        console.log(`   ✅ Generated ${imagesList.length} scenarios.`);

        // 3. Create Batch Document
        const batchData = {
            batch_id: "batch_002",
            version: "1.0.0",
            image_count: imagesList.length,
            uploaded_at: admin.firestore.Timestamp.now(),
            description: "GPE Tactical Scenarios - Batch 2 (Generated)",
            images: imagesList
        };

        console.log('\n💾 Saving to Firestore (batch_002)...');
        await db.doc('test_content/gto/scenarios/gpe/batches/batch_002').set(batchData);
        // Also support legacy path if needed, but stick to new schema
        // New Schema path used in code: COLLECTION_TEST_CONTENT / PATH_GTO / PATH_SCENARIOS / gpe / PATH_BATCHES / ...
        // i.e test_content/gto/scenarios/gpe/batches/batch_002

        // 4. Update Metadata
        const metaRef = db.doc('test_content/gto/scenarios/gpe/meta/overview');
        // Note: Code uses 'test_content/gto/scenarios/gpe/batches/...'
        // Let's create metadata at test_content/gto/scenarios/gpe (doc: metadata) or similar?
        // create-gpe-batch.js used: 'test_content/gpe/meta/overview' (old path?)
        // FirestoreGTORepository.kt uses: test_content/gto/scenarios/gpe/batches/{batchId}

        // Let's verify metadata location. I'll just save the batch. The random picker currently picks from DEFAULT_BATCH_ID (batch_001).
        // I should probably update the Repository to pick from ALL batches or valid batches.
        // For now, I will overwrite batch_001 OR create batch_002 and user asked for 19 sets to be ADDED.
        // If I add to a new batch, the app needs to know about it.
        // FirestoreGTORepository.kt line 125: val path = "$COLLECTION_TEST_CONTENT/$PATH_GTO/$PATH_SCENARIOS/gpe/$PATH_BATCHES/$DEFAULT_BATCH_ID"
        // It HARDCODES batch_001.
        // So I MUST overwrite batch_001 or update the code to pick random batch.
        // Updating code is better, but overwriting is safer for immediate result.
        // BUT wait, I might destroy existing data in batch_001 (User might have important data there?).
        // The user said "existing GPE tests" -> "uploads one GPE test set".
        // The user wants to enrich it.
        // I should probably READ batch_001, append my 19 scenarios, and WRITE IT BACK.
        // That's the safest way to "Add" to the existing test set without code changes for batch selection.

        console.log('\n🔄 Appending to batch_001...');
        const batch1Ref = db.doc('test_content/gto/scenarios/gpe/batches/batch_001');
        const batch1Doc = await batch1Ref.get();

        let finalImages = [];
        if (batch1Doc.exists) {
            const data = batch1Doc.data();
            console.log(`   Found existing batch_001 with ${data.images ? data.images.length : 0} images.`);
            finalImages = data.images || [];
        } else {
            console.log('   batch_001 not found. Creating new.');
        }

        // Append new images
        finalImages = [...finalImages, ...imagesList];

        await batch1Ref.set({
            batch_id: "batch_001",
            version: "1.1.0",
            image_count: finalImages.length,
            uploaded_at: admin.firestore.Timestamp.now(),
            description: "Merged GPE scenarios",
            images: finalImages
        }, { merge: true });

        console.log(`   ✅ Updated batch_001 with total ${finalImages.length} scenarios.`);

        console.log('\n✨ DONE! 19 Scenarios added.');

    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

main();
