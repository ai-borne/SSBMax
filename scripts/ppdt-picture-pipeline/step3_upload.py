#!/usr/bin/env python3
"""
Step 3 — Upload 64 extracted images to Firebase Storage and overwrite Firestore batch_001.

ONLY run after reviewing and approving preview.html from step2.

Steps:
  A) Delete all old files in gs://{BUCKET}/ppdt_images/batch_001/
  B) Upload 64 new JPEGs with public-read access
  C) Overwrite Firestore document test_content/ppdt/image_batches/batch_001

Usage:
  python step3_upload.py                                    # uses gcloud ADC
  python step3_upload.py --service-account path/to/key.json
  python step3_upload.py --dry-run                          # validate without changes
  python step3_upload.py --skip-delete                      # skip old file deletion

NOTE: After this script completes, update PPDTImageCacheManager.initialSync() in the Android
      app to download 'batch_001' instead of 'batch_002_context_enhanced'.
      (This Android change is part of Phase 6.)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "output"
IMAGES_DIR = OUTPUT_DIR / "images"
DRAFT_JSON = OUTPUT_DIR / "ppdt_context_draft.json"

BUCKET = "ssbmax-49e68.firebasestorage.app"
STORAGE_PREFIX = "ppdt_images/batch_001"
FIRESTORE_BATCH_PATH = "test_content/ppdt/image_batches/batch_001"

# Fields added for backward compatibility with existing PPDTImageCacheManager.
# PPDTImageCacheManager currently reads: imageDescription, context, viewingTimeSeconds,
# writingTimeMinutes, minCharacters, maxCharacters, category, difficulty.
# These will be superseded by imageContext in Phase 6.
COMPAT_DEFAULTS = {
    "viewingTimeSeconds": 30,
    "writingTimeMinutes": 4,
    "minCharacters": 200,
    "maxCharacters": 1000,
    "category": "general",
    "difficulty": "medium",
}


def load_draft() -> list[dict]:
    if not DRAFT_JSON.exists():
        raise FileNotFoundError(
            f"Draft JSON not found: {DRAFT_JSON}\n"
            "Run step2_generate_context.py first, then approve preview.html."
        )
    with open(DRAFT_JSON) as f:
        return json.load(f)


def init_firebase(service_account_path: str | None) -> tuple[Any, Any]:
    """Initialize Firebase Admin SDK. Returns (bucket, firestore_client).

    Uses a service account key if provided, otherwise falls back to
    Application Default Credentials (gcloud auth application-default login).
    """
    import firebase_admin
    from firebase_admin import credentials, firestore, storage

    if service_account_path:
        cred = credentials.Certificate(service_account_path)
    else:
        cred = credentials.ApplicationDefault()
        print("No service account provided — using Application Default Credentials.")

    project_id = BUCKET.split(".")[0]  # "ssbmax-49e68" from bucket name
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET, "projectId": project_id})
    bucket = storage.bucket()
    db = firestore.client()
    return bucket, db


def delete_old_images(bucket: Any, dry_run: bool) -> int:
    """Delete all blobs under the batch_001 prefix. Returns count deleted."""
    blobs = list(bucket.list_blobs(prefix=STORAGE_PREFIX + "/"))
    print(f"Found {len(blobs)} existing file(s) in gs://{BUCKET}/{STORAGE_PREFIX}/")
    if dry_run:
        for b in blobs:
            print(f"  [DRY RUN] would delete: {b.name}")
        return len(blobs)
    for blob in blobs:
        blob.delete()
        print(f"  Deleted: {blob.name}")
    return len(blobs)


def upload_images(bucket: Any, entries: list[dict], dry_run: bool) -> dict[int, tuple[str, str]]:
    """Upload JPEGs to Storage. Returns {imageNumber: (image_url, storage_path)}."""
    sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
    from firebase_image_upload import upload_image_and_get_url

    urls: dict[int, tuple[str, str]] = {}
    for entry in entries:
        img_id = entry["imageNumber"]
        local_path = IMAGES_DIR / f"ppdt_image_{img_id:03d}.jpg"
        if not local_path.exists():
            print(f"  [SKIP] Local file not found: {local_path}", file=sys.stderr)
            continue

        remote_path = f"{STORAGE_PREFIX}/ppdt_image_{img_id:03d}.jpg"

        if dry_run:
            print(f"  [DRY RUN] would upload {local_path.name} → {remote_path}")
            urls[img_id] = (f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{remote_path}?alt=media", remote_path)
            continue

        with open(local_path, "rb") as f:
            jpeg_bytes = f.read()
        image_url, storage_path = upload_image_and_get_url(bucket, jpeg_bytes, remote_path, "image/jpeg")
        urls[img_id] = (image_url, storage_path)
        print(f"  Uploaded: {local_path.name} → {image_url}")

    return urls


def build_firestore_document(entries: list[dict], urls: dict[int, tuple[str, str]]) -> dict:
    """Build the Firestore batch_001 document from draft entries and upload URLs."""
    images: list[dict] = []
    for entry in sorted(entries, key=lambda e: e["imageNumber"]):
        img_id = entry["imageNumber"]
        image_url, storage_path = urls.get(img_id, ("", ""))
        ctx = entry.get("imageContext", {})

        images.append({
            "id": entry["id"],
            "imageUrl": image_url,
            "storagePath": storage_path,
            "genderTag": entry.get("genderTag", "MIXED"),
            "imageContext": ctx,
            # Backward-compat fields for PPDTImageCacheManager (pre-Phase 6)
            "imageDescription": ctx.get("sceneDescription", "Ambiguous scene for PPDT"),
            "context": "",  # Deprecated — replaced by imageContext above
            **COMPAT_DEFAULTS,
        })

    return {
        "batchId": "batch_001",
        "version": "2.0.0",
        "totalImages": len(images),
        "images": images,
        "description": "64 Gemini-generated PPDT images with context (Phase 5)",
    }


def write_firestore(db: Any, document: dict, dry_run: bool) -> None:
    if dry_run:
        print(f"\n[DRY RUN] Would write {document['totalImages']} entries to {FIRESTORE_BATCH_PATH}")
        sample = document["images"][0] if document["images"] else {}
        print(f"  Sample entry keys: {list(sample.keys())}")
        return
    ref = db.document(FIRESTORE_BATCH_PATH)
    ref.set(document)
    print(f"\nFirestore updated: {FIRESTORE_BATCH_PATH}  ({document['totalImages']} images)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upload PPDT images to Firebase")
    parser.add_argument("--service-account", default=None, metavar="PATH",
                        help="Path to Firebase service account JSON key (default: gcloud ADC)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate everything without making changes to Firebase")
    parser.add_argument("--skip-delete", action="store_true",
                        help="Skip deleting old Storage files (useful for partial re-uploads)")
    args = parser.parse_args(argv)

    if args.service_account and not Path(args.service_account).exists():
        print(f"ERROR: Service account file not found: {args.service_account}", file=sys.stderr)
        return 1

    entries = load_draft()
    print(f"Loaded {len(entries)} entries from draft JSON.")

    # Validate all entries before touching Firebase
    from step2_generate_context import validate_entry
    invalid = [(e["id"], validate_entry(e)) for e in entries if validate_entry(e)]
    if invalid:
        print("ERROR: Validation failures in draft JSON (fix before uploading):", file=sys.stderr)
        for entry_id, errs in invalid:
            print(f"  {entry_id}: {errs}", file=sys.stderr)
        return 1

    print("\n--- Step A: Initialize Firebase ---")
    bucket, db = init_firebase(args.service_account)

    print("\n--- Step B: Delete old Storage files ---")
    if args.skip_delete:
        print("[skipped via --skip-delete]")
    else:
        delete_old_images(bucket, dry_run=args.dry_run)

    print("\n--- Step C: Upload new images ---")
    urls = upload_images(bucket, entries, dry_run=args.dry_run)

    print("\n--- Step D: Write Firestore batch_001 ---")
    doc = build_firestore_document(entries, urls)
    write_firestore(db, doc, dry_run=args.dry_run)

    action = "DRY RUN complete" if args.dry_run else "Upload complete"
    print(f"\n✓ {action}. {len(entries)} images processed.")
    if not args.dry_run:
        print("\nNEXT STEP: Update PPDTImageCacheManager.initialSync() in the Android app")
        print("  Change: downloadBatch(\"batch_002_context_enhanced\")")
        print("  To:     downloadBatch(\"batch_001\")")
        print("  This is part of Phase 6.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
