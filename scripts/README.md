# SSBMax Setup Scripts

This directory contains automation scripts for Firebase setup and maintenance.

## Prerequisites

1. **Firebase CLI installed** (already done ✓)
2. **Authenticated with Firebase** (run `firebase login`)
3. **google-services.json** exists in `app/` directory
4. **Node.js** installed (check with `node --version`)

## OIR Content Operations

The canonical OIR bank is stored at `test_content/oir/batches/batch_pdf_001..028`.
These commands are read-only unless `--commit` is explicitly supplied:

```bash
# Verify metadata, all batch IDs/totals, stable IDs, valid coverage, and every HTTPS image.
node check-oir-content-health.js

# Preview the current metadata target; this is always a dry run.
node set-oir-meta-config.js

# Publish metadata only after review (production write).
node set-oir-meta-config.js --version 4 --batches 28 --commit
```

`set-oir-meta-config.js` rejects a committed content-version downgrade and its default dry run
requires no credentials or network access. Set `FIREBASE_SERVICE_ACCOUNT` to the service-account
JSON path; no credential is stored in this repository. Use `oir-extraction/upload-oir-batch.js`
for new batch ingestion and run the health
check after a reviewed production upload. New OIR question JSON must not include a
difficulty field; legacy fields are tolerated only when reading existing data.

## Available Scripts

### 1. Firestore Collections Setup

**Purpose**: Automatically creates the 4 required Firestore collections with test documents.

**Usage**:

```bash
cd /Users/sunil/Downloads/SSBMax/scripts

# Install dependencies (first time only)
npm install

# Run the setup script
node setup-firestore.js
```

**What it creates**:

1. ✅ `health_check` collection
   - Document: `test`
   - Fields: status, timestamp, message

2. ✅ `content_versions` collection
   - Document: `global`
   - Fields: topicsVersion, materialsVersion, lastUpdated

3. ✅ `topic_content` collection
   - Document: `TEST` (temporary, will be replaced)
   - Fields: id, topicType, title, introduction, version

4. ✅ `study_materials` collection
   - Document: Auto-generated ID
   - Fields: All required fields for study materials

**Expected Output**:

```
============================================================
Firestore Collections Setup
============================================================

✓ Firebase Admin SDK initialized
✓ Project: your-project-id

Creating health_check collection...
  ✓ health_check/test document created

Creating content_versions collection...
  ✓ content_versions/global document created

Creating topic_content collection...
  ✓ topic_content/TEST document created
  Note: This test document will be replaced during migration

Creating study_materials collection...
  ✓ study_materials/abc123 document created
  Note: This test document will be replaced during migration

Verifying collections...

  ✓ health_check: 1 document(s)
  ✓ content_versions: 1 document(s)
  ✓ topic_content: 1 document(s)
  ✓ study_materials: 1 document(s)

============================================================
Setup Summary
============================================================
Collections created: 4/4
Verification: ✓ PASSED

✓ SUCCESS: All collections created successfully!

Next Steps:
1. Create Firestore indexes (Step 7 in guide)
2. Run health check from app (Step 9)
3. Test migration with OIR topic (Step 10)
```

## After Running This Script

**YOU STILL NEED TO**:

1. **Create Firestore Indexes** (Step 7)
   - Go to Firebase Console → Firestore → Indexes
   - Create composite index for `study_materials`:
     - Field 1: `topicType` (Ascending)
     - Field 2: `displayOrder` (Ascending)
   - Wait 2-5 minutes for index to build

2. **Verify from App** (Step 9)
   - Run health check from debug panel
   - Confirm all collections are readable

3. **Run Migration** (Step 10)
   - Test migration with OIR topic
   - Verify documents in Firebase Console

## Troubleshooting

### Error: "Cannot find module 'firebase-admin'"

**Solution**: Install dependencies first

```bash
cd /Users/sunil/Downloads/SSBMax/scripts
npm install
```

### Error: "Cannot find module '../app/google-services.json'"

**Solution**: Make sure `google-services.json` exists in the `app/` directory

```bash
ls -la /Users/sunil/Downloads/SSBMax/app/google-services.json
```

### Error: "PERMISSION_DENIED"

**Causes**:
1. Firebase security rules not deployed
2. Using wrong Firebase project

**Solution**:

```bash
# Deploy security rules first
cd /Users/sunil/Downloads/SSBMax
firebase deploy --only firestore:rules

# Check current project
firebase projects:list
```

### Error: "User credentials are required"

**Solution**: The script uses service account authentication (google-services.json), not user credentials. This error means the service account file is invalid or missing.

## Script Behavior

- ✅ Creates collections only if they don't exist
- ✅ Uses service account authentication (no user login needed)
- ✅ Verifies all collections after creation
- ✅ Provides detailed error messages
- ✅ Safe to run multiple times (won't duplicate)

## Files in This Directory

```
scripts/
├── README.md              # This file
├── package.json           # Node.js dependencies
└── setup-firestore.js     # Main setup script
```

## Next Scripts to Add (Future)

- `migrate-content.js` - Bulk content migration
- `backup-firestore.js` - Backup all Firestore data
- `cleanup-test-data.js` - Remove test documents
- `verify-indexes.js` - Check if all indexes are ready

---

**Ready to run?**

```bash
cd /Users/sunil/Downloads/SSBMax/scripts
npm install
node setup-firestore.js
```

