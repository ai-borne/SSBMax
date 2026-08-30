#!/usr/bin/env python3
"""
Step 2 — Replace cropped TAT images in Firebase.

This script uploads only the CROPPED images you've provided,
replacing their originals in Firebase Storage, while keeping
the Firestore document structure intact (just updates imageUrl fields).

USAGE:
  python step2_replace_cropped.py --list              # Show images to replace
  python step2_replace_cropped.py --dry-run           # Validate only
  python step2_replace_cropped.py                     # Upload and update Firestore

IMAGES TO REPLACE:
  4Women.png, 5Women.png, 8Women.png, 10Women.png, 11Women.png,
  12Women.png, 15Women.png, 52Mixed.png, 54Mixed.png, 42Men.png, 63Men.png
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

# CROPPED IMAGES TO REPLACE (user-provided list)
CROPPED_IMAGES = [
    "4Women.png",
    "5Women.png",
    "8Women.png",
    "10Women.png",
    "11Women.png",
    "12Women.png",
    "15Women.png",
    "52Mixed.png",
    "54Mixed.png",
    "42Men.png",
    "63Men.png",
]


def parse_image_id(filename: str) -> tuple[int, str] | None:
    """
    Map filename to (scene_number, gender_suffix).
    e.g. "4Women.png" → (4, "female")
          "42Men.png" → (42, "male")
          "52Mixed.png" → (52, "mixed")
    """
    if filename.endswith("Women.png"):
        try:
            num = int(filename.replace("Women.png", ""))
            return (num, "female")
        except ValueError:
            return None
    elif filename.endswith("Men.png"):
        try:
            num = int(filename.replace("Men.png", ""))
            return (num, "male")
        except ValueError:
            return None
    elif filename.endswith("Mixed.png"):
        try:
            num = int(filename.replace("Mixed.png", ""))
            return (num, "mixed")
        except ValueError:
            return None
    return None


def filename_to_image_id(filename: str) -> str | None:
    """Convert filename to Firestore image ID.
    e.g. "4Women.png" → "tat_004_female"
         "42Men.png" → "tat_042_male"
    """
    parsed = parse_image_id(filename)
    if not parsed:
        return None
    num, gender = parsed
    return f"tat_{num:03d}_{gender}"


def load_firestore_doc(db: Any) -> dict:
    """Load the current Firestore batch document."""
    doc = db.document(FIRESTORE_BATCH_PATH).get()
    if not doc.exists:
        raise RuntimeError(f"Firestore document not found: {FIRESTORE_BATCH_PATH}")
    return doc.to_dict()


def png_to_jpeg_bytes(png_path: Path, quality: int = 88) -> bytes:
    """Convert PNG to JPEG bytes."""
    from PIL import Image
    img = Image.open(png_path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def list_cropped_images():
    """List all cropped images and their target Firestore IDs."""
    print(f"Cropped images to replace ({len(CROPPED_IMAGES)} total):\n")
    for filename in CROPPED_IMAGES:
        image_id = filename_to_image_id(filename)
        source_path = SOURCE_DIR / filename
        exists = "✓" if source_path.exists() else "✗ MISSING"
        print(f"  {exists}  {filename:20} → {image_id}")
    print()


def init_firebase(service_account_path: str | None) -> tuple[Any, Any]:
    """Initialize Firebase Admin SDK."""
    import firebase_admin
    from firebase_admin import credentials, firestore, storage

    cred = (credentials.Certificate(service_account_path)
            if service_account_path
            else credentials.ApplicationDefault())
    if not service_account_path:
        print("Using Application Default Credentials (gcloud ADC)")

    project_id = BUCKET.split(".")[0]
    firebase_admin.initialize_app(cred, {"storageBucket": BUCKET, "projectId": project_id})
    return storage.bucket(), firestore.client()


def bump_version(version: str) -> str:
    """Bump patch version (e.g., "1.0.1" → "1.0.2")."""
    parts = version.split(".")
    if len(parts) == 3:
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return version


def upload_cropped_images(bucket: Any, dry_run: bool = False) -> dict[str, tuple[str, str]]:
    """
    Upload cropped images to Firebase Storage.
    Returns {image_id: (image_url, storage_path)}
    """
    sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
    from firebase_image_upload import upload_image_and_get_url

    urls: dict[str, tuple[str, str]] = {}
    uploaded = 0

    for filename in CROPPED_IMAGES:
        image_id = filename_to_image_id(filename)
        if not image_id:
            print(f"  ✗ SKIP — invalid filename: {filename}")
            continue

        source_path = SOURCE_DIR / filename
        if not source_path.exists():
            print(f"  ✗ SKIP — not found: {source_path}")
            continue

        remote_path = f"{STORAGE_PREFIX}/{image_id}.jpg"

        if dry_run:
            print(f"  [DRY RUN] {filename:20} → {remote_path}")
            urls[image_id] = (f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{remote_path}?alt=media", remote_path)
            uploaded += 1
        else:
            try:
                jpeg_bytes = png_to_jpeg_bytes(source_path)
                image_url, storage_path = upload_image_and_get_url(bucket, jpeg_bytes, remote_path, "image/jpeg")
                urls[image_id] = (image_url, storage_path)
                print(f"  ✓ {filename:20} → {image_id}")
                uploaded += 1
            except Exception as e:
                print(f"  ✗ {filename:20} — Error: {e}", file=sys.stderr)

    return urls


def update_firestore_with_new_urls(
    db: Any,
    firestore_doc: dict,
    new_urls: dict[str, tuple[str, str]],
    dry_run: bool = False
) -> int:
    """
    Update Firestore batch document with new image URLs and bumped version.
    Returns count of updated images.
    """
    images = firestore_doc.get("images", [])
    updated_count = 0

    # Update image URLs in the document
    for img in images:
        image_id = img.get("id")
        if image_id in new_urls:
            image_url, storage_path = new_urls[image_id]
            img["imageUrl"] = image_url
            img["storagePath"] = storage_path
            updated_count += 1

    # Bump version
    current_version = firestore_doc.get("version", "1.0.0")
    new_version = bump_version(current_version)

    firestore_doc["version"] = new_version

    if dry_run:
        print(f"  [DRY RUN] Would update {updated_count} image URLs in Firestore")
        print(f"  [DRY RUN] Version: {current_version} → {new_version}")
        return updated_count

    # Write updated document to Firestore
    try:
        db.document(FIRESTORE_BATCH_PATH).set(firestore_doc)
        print(f"  ✓ Updated {updated_count} image URLs in Firestore")
        print(f"  ✓ Version bumped: {current_version} → {new_version}")
        return updated_count
    except Exception as e:
        print(f"  ✗ Firestore update failed: {e}", file=sys.stderr)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Replace cropped TAT images in Firebase"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List cropped images and exit"
    )
    parser.add_argument(
        "--service-account", default=None, metavar="PATH",
        help="Path to Firebase service account JSON (default: gcloud ADC)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Validate and preview without uploading"
    )
    args = parser.parse_args(argv)

    if args.list:
        list_cropped_images()
        return 0

    print("=" * 70)
    print("CROPPED IMAGE REPLACEMENT TOOL")
    print("=" * 70)

    # Step 1: List images
    print("\n[Step 1] Images to replace:")
    list_cropped_images()

    # Step 2: Validate files exist
    print("[Step 2] Validating source files:")
    missing = [f for f in CROPPED_IMAGES if not (SOURCE_DIR / f).exists()]
    if missing:
        print(f"  ✗ ERROR: {len(missing)} file(s) not found:")
        for f in missing:
            print(f"    - {SOURCE_DIR / f}")
        return 1
    print(f"  ✓ All {len(CROPPED_IMAGES)} files found")

    # Step 3: Initialize Firebase
    print(f"\n[Step 3] Initializing Firebase...")
    try:
        bucket, db = init_firebase(args.service_account)
        print(f"  ✓ Connected to Firebase")
    except Exception as e:
        print(f"  ✗ Firebase initialization failed: {e}", file=sys.stderr)
        return 1

    # Step 4: Load current Firestore document
    print(f"\n[Step 4] Loading current Firestore document:")
    try:
        firestore_doc = load_firestore_doc(db)
        current_version = firestore_doc.get("version", "1.0.0")
        total_images = firestore_doc.get("totalImages", 0)
        print(f"  ✓ Loaded: {total_images} images, version {current_version}")
    except Exception as e:
        print(f"  ✗ Load failed: {e}", file=sys.stderr)
        return 1

    # Step 5: Upload cropped images
    print(f"\n[Step 5] Uploading cropped images:")
    try:
        new_urls = upload_cropped_images(bucket, dry_run=args.dry_run)
        print(f"  ✓ Processed {len(new_urls)}/{len(CROPPED_IMAGES)} images")
    except Exception as e:
        print(f"  ✗ Upload failed: {e}", file=sys.stderr)
        return 1

    # Step 6: Update Firestore
    print(f"\n[Step 6] Updating Firestore document:")
    try:
        updated = update_firestore_with_new_urls(
            db, firestore_doc, new_urls, dry_run=args.dry_run
        )
    except Exception as e:
        print(f"  ✗ Firestore update failed: {e}", file=sys.stderr)
        return 1

    # Final summary
    print("\n" + "=" * 70)
    action = "DRY RUN COMPLETE" if args.dry_run else "REPLACEMENT COMPLETE"
    print(action)
    print("=" * 70)
    print(f"  ✓ {len(new_urls)} images uploaded")
    print(f"  ✓ {updated} image URLs updated in Firestore")
    print(f"  ✓ Version bumped to trigger cache invalidation")
    print(f"\nAndroid clients will detect the version change on next app launch")
    print(f"or within 24 hours via the TTL gate.")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
