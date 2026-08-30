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

// Local paths to generated images (Assuming in artifacts directory)
const ARTIFACTS_DIR = '/Users/sunil/.gemini/antigravity/brain/fc7789c2-dea3-4ab6-ac9d-2171f5a718a9';

// Define the 4 NEW maps
const MAPS = [
    {
        type: 'dam',
        glob: 'gpe_map_dam_reservoir_*.png',
        description: "Dam and Reservoir Area. Features: Large dam, hydroelectric station, river, bridge, township, and forest."
    },
    {
        type: 'border',
        glob: 'gpe_map_mountain_border_*.png',
        description: "High Altitude Border Post. Features: Snow peaks, mountain pass, army post, helipad, frozen lake, and border track."
    },
    {
        type: 'jungle',
        glob: 'gpe_map_jungle_airstrip_*.png',
        description: "Deep Jungle with Airstrip. Features: Old airstrip, dense forest, tribal settlement, abandoned mine, and river."
    },
    {
        type: 'industrial',
        glob: 'gpe_map_industrial_sector_*.png',
        description: "Coastal Industrial Sector. Features: Chemical factory, railway yard, worker colony, swamp, and highway."
    }
];

// Resolves the actual filename using the glob pattern
function resolveMapPath(map) {
    const files = fs.readdirSync(ARTIFACTS_DIR);
    const match = files.find(f => f.startsWith(map.glob.replace('*.png', '')) && f.endsWith('.png'));
    if (match) {
        return path.join(ARTIFACTS_DIR, match);
    }
    return null;
}

// Scenarios Generator for NEW Maps
function getScenariosForMap(mapType, mapUrl) {
    const common = {
        viewingTimeSeconds: 60,
        planningTimeSeconds: 1740,
        minCharacters: 500,
        maxCharacters: 2000,
        difficulty: "HARD"
    };

    switch (mapType) {
        case 'dam':
            return [
                {
                    ...common,
                    scenario: "Dam Security: 1. A crack is spotted in the dam wall after a tremor. 2. A group of underwater saboteurs is spotted approaching the power station. 3. The township manager reports a chlorine gas leak in the water plant. 4. A school bus is stuck on the downstream bridge due to an engine failure. Resources: 1 Patrol Boat, Divers, Repair crew.",
                    solution: "Priority 1: Gas Leak. Immediate evacuation/containment (wind direction critical). Priority 2: Saboteurs. Intercept with patrol boat/security. Priority 3: Dam Crack. Inspect/Release water to lower pressure if needed. Priority 4: School Bus. Tow away or evacuate children. Plan: Security engages saboteurs. Tech team to gas leak. Engineers to Dam. Transport team aids bus.",
                    title: "Dam Threat"
                },
                {
                    ...common,
                    scenario: "Monsoon Crisis: 1. Reservoir overflowing, gates stuck. 2. A fisherman's boat capsized in the turbulence. 3. Landslide blocked the road to the power station. 4. Village downstream is flooding. Resources: Crane, 1 Truck.",
                    solution: "Priority 1: Stuck Gates/Flood. Clear blockage/manual override to prevent dam failure. Priority 2: Capsized Boat. Rescue fisherman. Priority 3: Flooding Village. Evacuate to high ground. Priority 4: Road. Clear later. Plan: Engineering team to gates. Raft/swimmers to boat. Truck evacuates village.",
                    title: "Dam Flood"
                },
                {
                    ...common,
                    scenario: "Power Station Emergency: 1. Fire in the main turbine hall. 2. A worker is electrocuted and unconscious. 3. Protestors blocking the main gate. 4. A leopard entered the staff colony. Resources: Fire tender, Ambulance.",
                    solution: "Priority 1: Electrocuted worker. Isolate power, CPR, hospital. Priority 2: Fire. Extinguish to prevent explosion. Priority 3: Leopard. Warn residents, Forest dept. Priority 4: Protestors. Police. Plan: Fire team fights fire. Medic takes worker (via back gate). Security holds gate. Colony warden manages leopard safety.",
                    title: "Power Station Fire"
                },
                {
                    ...common,
                    scenario: "Grid Failure: 1. Total grid collapse, dam controls offline. 2. Cyber attack suspected on control center. 3. A VIP delegation is trapped in the inspection lift. 4. Backup generators failed. Resources: Manual tools, Satellite phone.",
                    solution: "Priority 1: Dam Controls. Switch to manual/mechanical override. Priority 2: Trapped VIPs. Manual winch rescue. Priority 3: Cyber Attack. Isolate network. Priority 4: Generators. Repair. Plan: Techs isolate network. Mechanics man dam gates. Rescue team to lift.",
                    title: "Blackout at Dam"
                }
            ];
        case 'border':
            return [
                {
                    ...common,
                    scenario: "High Altitude Patrol: 1. An avalanche buried a 3-man patrol near the pass. 2. Enemy UAV spotted hovering over the post. 3. The only generator at the post caught fire. 4. A porter has severe altitude sickness (HAPE). Resources: Snow scooters, Radio.",
                    solution: "Priority 1: Avalanche. Immediate search and rescue (time critical). Priority 2: HAPE. Rapid descent/oxygen. Priority 3: UAV. Shoot down/Jam. Priority 4: Fire. Extinguish. Plan: G1 (Search team) to pass. G2 (Medic) evacuates porter. G3 (Sentry) engages UAV. G4 fights fire.",
                    title: "Avalanche Rescue"
                },
                {
                    ...common,
                    scenario: "Border Skirmish: 1. Enemy shelling started on the forward post. 2. A bridge on the supply route is blown up. 3. A shepherd is injured by a landmine in the valley. 4. Communications line cut. Resources: Mortars, First Aid.",
                    solution: "Priority 1: Shelling. Take cover, retaliate/counter-battery. Priority 2: Injured Shepherd. Bring to safety during lull. Priority 3: Comms. Use Radio/Runner. Priority 4: Bridge. Report/Find bypass. Plan: Post returns fire. Medic team retrieves shepherd. Signaller restores radio link.",
                    title: "Shelling Incident"
                },
                {
                    ...common,
                    scenario: "Winter Convoy: 1. Convoy stuck in snow drift at the pass. 2. Driver hypothermia. 3. Wolf pack threatening the hamlet's livestock. 4. Smugglers spotted using the goat track. Resources: Recovery vehicle, skis.",
                    solution: "Priority 1: Hypothermia. Warmth, evacuate. Priority 2: Convoy. Dig out. Priority 3: Smugglers. Intercept. Priority 4: Wolves. Scare away. Plan: Recovery team aids driver/convoy. Patrol team intercepts smugglers. Village guard handles wolves.",
                    title: "Frozen Pass"
                },
                {
                    ...common,
                    scenario: "Helipad Emergency: 1. Incoming helicopter developed engine trouble (crash landing imminent). 2. Sudden blizzard reduced visibility to zero. 3. A terrorist group is trying to infiltrate near the frozen lake. 4. Post water supply frozen. Resources: Flares, HMG.",
                    solution: "Priority 1: Helicopter. Guide via radio/flares, prep crash crew. Priority 2: Infiltrators. Ambush/Engage. Priority 3: Water/Blizzard. Hunker down. Plan: ATC guides chopper. QRT moves to lake to intercept terrorists.",
                    title: "Chopper Down"
                }
            ];
        case 'jungle':
            return [
                {
                    ...common,
                    scenario: "Jungle Patrol: 1. A plane crashed near the abandoned mine (smoke seen). 2. Tribal chief reports mysterious illness in village. 3. Illegal loggers blocking the dirt track. 4. A forest fire starting near the airstrip. Resources: Machetes, Med kit.",
                    solution: "Priority 1: Plane Crash. Survivor rescue/First aid. Priority 2: Fire. Create fire break to save airstrip. Priority 3: Illness. Quarantine/Radio for doctors. Priority 4: Loggers. Arrest/Clear. Plan: G1 to crash site. G2 fights fire. G3 secures village. G4 clears track.",
                    title: "Jungle Crash"
                },
                {
                    ...common,
                    scenario: "Airstrip Defense: 1. Hostiles attacking the airstrip to seize a supply plane. 2. Pilot is wounded. 3. Fuel dump is leaking. 4. A snake bit a sentry. Resources: LMG, Sandbags.",
                    solution: "Priority 1: Defense. Repel attack. Priority 2: Wounded Pilot/Sentry. First aid/Evac. Priority 3: Fuel leak. Contain (fire hazard). Plan: Defensive perimeter established. Medics treat casualties. Engineers plug leak.",
                    title: "Airfield Attack"
                },
                {
                    ...common,
                    scenario: "River Ambush: 1. Boat patrol ambushed near 'Bambu' settlement. 2. Villagers fleeing into the mine field. 3. A crocodile attacked a swimmer. 4. Radio lost in river. Resources: Flares, Rifle.",
                    solution: "Priority 1: Ambush. Return fire, extract patrol. Priority 2: Minefield. Stop villagers (shout/warn). Priority 3: Crocodile. Shoot/Scare. Priority 4: Comms. Use flares. Plan: Fire team suppresses ambush. Guide stops villagers. Marksman handles croc.",
                    title: "Riverine Ops"
                },
                {
                    ...common,
                    scenario: "Search Operation: 1. Search for lost geologist in the dense jungle. 2. Flash flood in the river cut off the return route. 3. A team member fell into a trapping pit. 4. Wild elephants charging the camp. Resources: Rope, Whistle.",
                    solution: "Priority 1: Charging Elephants. Noise/Fire to scare. Priority 2: Pit Fall. Rescue with rope. Priority 3: Flood. Move to high ground. Priority 4: Geologist. Continue tracking after safety. Plan: Sentry scares elephants. Team extracts pit victim. Move camp up. Resume search.",
                    title: "Lost in Jungle"
                }
            ];
        case 'industrial':
            return [
                {
                    ...common,
                    scenario: "Chemical Leak: 1. Toxic gas leak at the chemical factory (wind blowing to colony). 2. Train derailment at the yard blocking the crossing. 3. Panic in the worker's colony. 4. Fire in the swamp (methane). Resources: Gas masks, PA system.",
                    solution: "Priority 1: Gas Leak. Stop leak/Evacuate colony (Upwind). Priority 2: Panic. Calm crowd/Guide. Priority 3: Train. Cordon off. Priority 4: Swamp Fire. monitor. Plan: Hazmat team to factory. Police/Admin evacuates colony. Fire dept to standby.",
                    title: "Industrial Disaster"
                },
                {
                    ...common,
                    scenario: "Worker Strike: 1. Violent strike at factory gates. 2. Sabotage of the water treatment plant (water contamination risk). 3. Traffic accident on the highway. 4. Loading yard crane collapsed on workers. Resources: Riot gear, Ambulance.",
                    solution: "Priority 1: Crane/Injured. Rescue survivors. Priority 2: Water Sabotage. Shut supply/Warn. Priority 3: Accident. First aid. Priority 4: Strike. Negotiation/Police. Plan: Rescue team to yard. Engineers to water plant. Medics to highway. Security contains strike.",
                    title: "Strike Chaos"
                },
                {
                    ...common,
                    scenario: "Coastal Storm: 1. Hurricane hitting the coast. 2. Chemical drums washing into the creek (pollution). 3. Shelter roof blew off in colony. 4. Power lines down on the highway. Resources: Trucks, Tarps.",
                    solution: "Priority 1: Power Lines. Cut power/Cordon. Priority 2: Roofless Shelter. Move people to solid building. Priority 3: Chemical Drums. Retrieve/Secure. Plan: Electricians cut power. Trucks move people. Team secures drums.",
                    title: "Hurricane Watch"
                },
                {
                    ...common,
                    scenario: "Terror Plot: 1. Bomb threat to the chemical plant tanks. 2. Snipers spotted on the loading yard tower. 3. Highway bridge rigged with explosives. 4. Hostages taken in admin block. Resources: SWAT team, Bomb squad.",
                    solution: "Priority 1: Bomb/Tanks. Diffuse. Priority 2: Hostages/Snipers. Neutralize/Rescue. Priority 3: Bridge. Stop traffic/Diffuse. Plan: Bomb squad to tanks. SWAT neutralizes snipers and rescues hostages. Traffic police close highway.",
                    title: "Factory Siege"
                }
            ];
        default:
            return [];
    }
}

async function main() {
    try {
        console.log('🚀 Starting ADDITIONAL GPE Batch Upload (Batch 2 supplement)...');

        const mapUploads = [];

        // 1. Upload Images
        for (const map of MAPS) {
            const localPath = resolveMapPath(map);
            if (!localPath) {
                console.error(`⚠️ Could not find file for ${map.type} (glob: ${map.glob}). Skipping.`);
                continue;
            } console.log(`\n📤 Uploading map: ${map.type} (${path.basename(localPath)})`);

            console.log(`   Found file: ${localPath}`);

            const fileName = `gpe_map_${map.type}_${Date.now()}.png`;
            const destination = `gpe_images/batch_003/${fileName}`; // Keep in new folder just in case

            const { imageUrl, storagePath } = await uploadImageAndGetUrl(bucket, localPath, destination, 'image/png');

            console.log(`   ✅ Uploaded: ${imageUrl}`);

            mapUploads.push({
                type: map.type,
                url: imageUrl,
                storagePath,
                desc: map.description
            });
        }

        // 2. Generate Scenarios
        console.log('\n🧠 Generating Scenarios for NEW maps...');
        const newImagesList = [];
        // We'll use a high start index to avoid ID collision if we were using sequential IDs, 
        // but let's base it on existing count + 1 if possible, or just random/high enough.
        // batch_001 might have ~19 items. Let's start IDs from 100 to be safe.
        var globalIndex = 100;

        for (const map of mapUploads) {
            const scenarios = getScenariosForMap(map.type, map.url);

            for (const s of scenarios) {
                globalIndex++;
                const id = `gpe_badd_${String(globalIndex).padStart(3, '0')}`;

                newImagesList.push({
                    id: id,
                    imageUrl: map.url,
                    imageStoragePath: map.storagePath,
                    scenario: s.scenario,
                    solution: s.solution,
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

        console.log(`   ✅ Generated ${newImagesList.length} new scenarios.`);

        // 3. Append to Firestore batch_001
        console.log('\n🔄 Appending to batch_001...');
        const batch1Ref = db.doc('test_content/gto/scenarios/gpe/batches/batch_001');
        const batch1Doc = await batch1Ref.get();

        let finalImages = [];
        if (batch1Doc.exists) {
            const data = batch1Doc.data();
            console.log(`   Found existing batch_001 with ${data.images ? data.images.length : 0} images.`);
            finalImages = data.images || [];
        } else {
            console.log('   batch_001 not found. Creating new (unexpected).');
        }

        // Merge lists
        finalImages = [...finalImages, ...newImagesList];

        await batch1Ref.set({
            batch_id: "batch_001",
            version: "1.2.0", // Bump version
            image_count: finalImages.length,
            uploaded_at: admin.firestore.Timestamp.now(), // Update timestamp
            description: "Merged GPE scenarios (Base + Additional 4 Maps)",
            images: finalImages
        }, { merge: true });

        console.log(`   ✅ Updated batch_001. TOTAL SCENARIOS: ${finalImages.length}`);

        // Count unique situations (just in case)
        const uniqueTitles = new Set(finalImages.map(i => i.title));
        console.log(`   🧐 Unique Scenario Titles: ${uniqueTitles.size}`);

        console.log('\n✨ DONE! Added new scenarios.');

    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

main();
