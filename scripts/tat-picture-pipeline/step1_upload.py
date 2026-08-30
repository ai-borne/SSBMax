#!/usr/bin/env python3
"""
Step 1 — Upload 167 TAT images to Firebase Storage and overwrite Firestore batch_001.

ONLY run after reviewing and approving output/preview.html from step0.
Finalize the context JSON first:
  cp output/tat_context_draft.json tat_image_contexts.json

Steps:
  A) Delete old files under gs://{BUCKET}/tat_images/batch_001/
  B) Upload 167 PNGs (converted to JPEG, quality=88) to Storage
  C) Overwrite Firestore: test_content/tat/image_batches/batch_001
     (all 167 images, version 1.0.0)

Usage:
  python step1_upload.py                                     # uses gcloud ADC
  python step1_upload.py --service-account path/to/key.json
  python step1_upload.py --dry-run                           # validate only, no writes
  python step1_upload.py --skip-delete                       # skip old file deletion

Version bump: every run bumps the patch version (1.0.0 → 1.0.1 → …).
The Android TATImageCacheManager uses this version to detect stale cache.
"""

import argparse
import io
import json
import sys
from pathlib import Path
from typing import Any

SOURCE_DIR = Path("/Users/sunil/Downloads/TAT Work/Cropped_images")
SCRIPT_DIR = Path(__file__).parent
CONTEXTS_JSON = SCRIPT_DIR / "tat_image_contexts.json"

BUCKET = "ssbmax-49e68.firebasestorage.app"
STORAGE_PREFIX = "tat_images/batch_001"
FIRESTORE_BATCH_PATH = "test_content/tat/image_batches/batch_001"
INITIAL_VERSION = "1.0.0"

IMAGE_DEFAULTS = {
    "viewingTimeSeconds": 30,
    "writingTimeMinutes": 4,
    "minCharacters": 150,
    "maxCharacters": 1500,
}

VALID_OLQ_NAMES = {
    "EFFECTIVE_INTELLIGENCE", "REASONING_ABILITY", "ORGANIZING_ABILITY",
    "POWER_OF_EXPRESSION", "SOCIAL_ADJUSTMENT", "COOPERATION",
    "SENSE_OF_RESPONSIBILITY", "INITIATIVE", "SELF_CONFIDENCE",
    "SPEED_OF_DECISION", "INFLUENCE_GROUP", "LIVELINESS",
    "DETERMINATION", "COURAGE", "STAMINA",
}

REQUIRED_CONTEXT_KEYS = {
    "sceneDescription", "coreElements", "ambiguousElements",
    "expectedThemes", "penalizedThemes", "primaryOLQs",
    "deviationTolerance", "exemplarGoodHints", "exemplarBadHints",
}

VALID_DEVIATION_TOLERANCES = {"LOW", "MEDIUM", "HIGH"}


def load_contexts() -> list[dict]:
    if not CONTEXTS_JSON.exists():
        raise FileNotFoundError(
            f"Contexts JSON not found: {CONTEXTS_JSON}\n"
            "Run step0 first, review preview.html, then:\n"
            "  cp output/tat_context_draft.json tat_image_contexts.json"
        )
    with open(CONTEXTS_JSON) as f:
        return json.load(f)


def validate_entry(entry: dict) -> list[str]:
    errors: list[str] = []
    ctx = entry.get("imageContext", {})

    missing = REQUIRED_CONTEXT_KEYS - set(ctx.keys())
    if missing:
        errors.append(f"Missing imageContext keys: {sorted(missing)}")

    invalid_olqs = [o for o in ctx.get("primaryOLQs", []) if o not in VALID_OLQ_NAMES]
    if invalid_olqs:
        errors.append(f"Invalid OLQs: {invalid_olqs}")

    if ctx.get("deviationTolerance") not in VALID_DEVIATION_TOLERANCES:
        errors.append(f"Invalid deviationTolerance: {ctx.get('deviationTolerance')!r}")

    pos = entry.get("cardPosition", 0)
    if not (1 <= pos <= 11):
        errors.append(f"cardPosition {pos} out of range 1–11")

    if not entry.get("genderTag") in ("MALE", "FEMALE", "MIXED"):
        errors.append(f"Invalid genderTag: {entry.get('genderTag')!r}")

    return errors


def validate_contexts(entries: list[dict]) -> bool:
    invalid = [(e.get("id", "?"), validate_entry(e)) for e in entries if validate_entry(e)]
    if invalid:
        print("ERROR: Validation failures (fix before upload):", file=sys.stderr)
        for entry_id, errs in invalid:
            print(f"  {entry_id}: {errs}", file=sys.stderr)
        return False

    # Distribution check
    from collections import defaultdict
    pos_counts: dict[int, dict] = defaultdict(lambda: {"total": 0, "female_mixed": 0})
    for e in entries:
        pos = e.get("cardPosition", 0)
        pos_counts[pos]["total"] += 1
        if e.get("genderTag") in ("FEMALE", "MIXED"):
            pos_counts[pos]["female_mixed"] += 1

    warnings: list[str] = []
    for pos in range(1, 12):
        t = pos_counts[pos]["total"]
        fm = pos_counts[pos]["female_mixed"]
        if t < 10:
            warnings.append(f"Position {pos}: only {t} images (minimum 10 recommended)")
        if fm < 3:
            warnings.append(f"Position {pos}: only {fm} FEMALE+MIXED images (minimum 3)")

    if warnings:
        print("Validation warnings (upload will proceed):", file=sys.stderr)
        for w in warnings:
            print(f"  ⚠ {w}", file=sys.stderr)

    return True


def bump_version(version: str) -> str:
    parts = version.split(".")
    if len(parts) == 3:
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return version


def get_current_version(db: Any) -> str | None:
    """Read current Firestore version, or None if document doesn't exist."""
    try:
        doc = db.document(FIRESTORE_BATCH_PATH).get()
        if doc.exists:
            return doc.to_dict().get("version")
    except Exception:
        pass
    return None


def init_firebase(service_account_path: str | None) -> tuple[Any, Any]:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage

    cred = (credentials.Certificate(service_account_path)
            if service_account_path
            else credentials.ApplicationDefault())
    if not service_account_path:
        print("No service account provided — using Application Default Credentials.")

    project_id = BUCKET.split(".")[0]
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET, "projectId": project_id})
    return storage.bucket(), firestore.client()


def delete_old_images(bucket: Any, dry_run: bool) -> int:
    blobs = list(bucket.list_blobs(prefix=STORAGE_PREFIX + "/"))
    print(f"Found {len(blobs)} existing file(s) under gs://{BUCKET}/{STORAGE_PREFIX}/")
    if dry_run:
        for b in blobs:
            print(f"  [DRY RUN] delete: {b.name}")
        return len(blobs)
    for blob in blobs:
        blob.delete()
        print(f"  Deleted: {blob.name}")
    return len(blobs)


def png_to_jpeg_bytes(png_path: Path, quality: int = 88) -> bytes:
    from PIL import Image
    img = Image.open(png_path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def upload_images(bucket: Any, entries: list[dict], dry_run: bool) -> dict[str, tuple[str, str]]:
    """Upload PNGs as JPEGs to Storage. Returns {image_id: (image_url, storage_path)}."""
    sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
    from firebase_image_upload import upload_image_and_get_url

    urls: dict[str, tuple[str, str]] = {}
    for i, entry in enumerate(entries, 1):
        image_id = entry["id"]
        local_path = SOURCE_DIR / entry.get("sourceFile", "")
        if not local_path.exists():
            print(f"  [{i}/{len(entries)}] SKIP — not found: {local_path}", file=sys.stderr)
            continue

        remote_path = f"{STORAGE_PREFIX}/{image_id}.jpg"

        if dry_run:
            print(f"  [{i}/{len(entries)}] [DRY RUN] {local_path.name} → {remote_path}")
            urls[image_id] = (f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{remote_path}?alt=media", remote_path)
            continue

        jpeg_bytes = png_to_jpeg_bytes(local_path)
        image_url, storage_path = upload_image_and_get_url(bucket, jpeg_bytes, remote_path, "image/jpeg")
        urls[image_id] = (image_url, storage_path)
        print(f"  [{i}/{len(entries)}] Uploaded: {local_path.name} → {image_url}")

    return urls


def build_firestore_document(entries: list[dict], urls: dict[str, tuple[str, str]], version: str) -> dict:
    images: list[dict] = []
    for entry in sorted(entries, key=lambda e: (e.get("sceneNumber", 0), e.get("genderTag", ""))):
        image_id = entry["id"]
        ctx = entry.get("imageContext", {})
        image_url, storage_path = urls.get(image_id, ("", ""))
        images.append({
            "id": image_id,
            "sourceFile": entry.get("sourceFile", ""),
            "imageUrl": image_url,
            "storagePath": storage_path,
            "cardPosition": entry.get("cardPosition", 0),
            "genderTag": entry.get("genderTag", "MIXED"),
            "imageContext": ctx,
            "category": entry.get("category", "General"),
            "difficulty": entry.get("difficulty", "Medium"),
            **IMAGE_DEFAULTS,
        })

    return {
        "batchId": "batch_001",
        "version": version,
        "totalImages": len(images),
        "images": images,
        "description": "167 TAT images with Gemini-generated context (Phase 0)",
    }


def write_firestore(db: Any, document: dict, dry_run: bool) -> None:
    if dry_run:
        print(f"\n[DRY RUN] Would write to {FIRESTORE_BATCH_PATH}")
        print(f"  totalImages: {document['totalImages']}, version: {document['version']}")
        if document["images"]:
            print(f"  Sample entry keys: {list(document['images'][0].keys())}")
        return
    ref = db.document(FIRESTORE_BATCH_PATH)
    ref.set(document)
    print(f"\nFirestore updated: {FIRESTORE_BATCH_PATH}")
    print(f"  totalImages: {document['totalImages']}, version: {document['version']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upload TAT images to Firebase")
    parser.add_argument("--service-account", default=None, metavar="PATH",
                        help="Path to Firebase service account JSON key (default: gcloud ADC)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate everything without making changes to Firebase")
    parser.add_argument("--skip-delete", action="store_true",
                        help="Skip deleting old Storage files")
    parser.add_argument("--skip-validate", action="store_true",
                        help="Skip pre-upload validation (not recommended)")
    args = parser.parse_args(argv)

    entries = load_contexts()
    print(f"Loaded {len(entries)} entries from {CONTEXTS_JSON.name}")

    if not args.skip_validate:
        if not validate_contexts(entries):
            return 1
        print(f"Validation passed. {len(entries)} entries ready.")

    print("\n--- Step A: Initialize Firebase ---")
    bucket, db = init_firebase(args.service_account)

    current_version = get_current_version(db)
    new_version = bump_version(current_version) if current_version else INITIAL_VERSION
    print(f"Version: {current_version or 'none'} → {new_version}")

    print("\n--- Step B: Delete old Storage files ---")
    if args.skip_delete:
        print("[skipped via --skip-delete]")
    else:
        delete_old_images(bucket, dry_run=args.dry_run)

    print(f"\n--- Step C: Upload {len(entries)} images ---")
    urls = upload_images(bucket, entries, dry_run=args.dry_run)

    print("\n--- Step D: Write Firestore batch_001 ---")
    doc = build_firestore_document(entries, urls, new_version)
    write_firestore(db, doc, dry_run=args.dry_run)

    action = "DRY RUN complete" if args.dry_run else "Upload complete"
    print(f"\n{action}. {len(urls)}/{len(entries)} images processed.")
    if not args.dry_run:
        print("\nNEXT STEP: Phase 1 bug fixes, then Phase 2 progressive architecture.")
        print("  Android TATImageCacheManager will sync from batch_001 on next app launch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
