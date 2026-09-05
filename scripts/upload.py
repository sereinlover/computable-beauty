#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Batch-upload every audio file in a directory to a running gateway/web
instance's POST /api/analyze.

Skips files whose content hash already has a status=done job — checked
against GET /api/history before uploading anything, so already-analyzed
tracks never get a new job created for them. Uses only the stdlib — the
`dependencies = []` above just lets `uv run` pick a Python without needing
a project directory of its own.

Usage:
    uv run scripts/upload.py /path/to/songs
    uv run scripts/upload.py /path/to/songs --language en --base-url http://localhost:3000
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

# Matches apps/gateway/internal/server/jobs.go's allowedAudioExt.
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg"}

# Matches apps/gateway/internal/server/jobs.go's maxListJobLimit.
HISTORY_PAGE_SIZE = 100

# Gateway's worker processes jobs one at a time (biz.Worker.Run), and
# apps/web's "active jobs" queue view only fetches the newest 100 jobs
# (lib/gateway.ts's fetchActiveJobs) — pushing more than that in one run in
# a single batch buries the older ones outside that fetch window, making the
# UI misreport queue position/depth even though nothing is actually stuck.
MAX_UPLOADS_PER_RUN = 100


def sha256_of_file(path: Path) -> str:
    """Same hash gateway computes on upload (utils.HashAndSaveFile) — lets
    this script recognize a file as already-analyzed without asking gateway
    to hash it first."""
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def fetch_analyzed_audio_ids(base_url: str) -> set[str]:
    """Every audio_id with a status=done job, paginated through
    GET /api/history (web's passthrough to gateway's GET /api/jobs)."""
    audio_ids: set[str] = set()
    offset = 0
    while True:
        url = f"{base_url}/api/history?status=done&limit={HISTORY_PAGE_SIZE}&offset={offset}"
        with urllib.request.urlopen(url) as resp:
            body = json.loads(resp.read())
        items = body["data"]["items"]
        total = body["data"]["total"]
        for item in items:
            result = item.get("result")
            if result and result.get("audio_id"):
                audio_ids.add(result["audio_id"])
        offset += len(items)
        if not items or offset >= total:
            break
    return audio_ids


def build_multipart_body(fields: dict[str, str], file_field: str, file_path: Path) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts = [
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode()
        for name, value in fields.items()
    ]
    content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode()
    footer = f"\r\n--{boundary}--\r\n".encode()
    body = b"".join(parts) + header + file_path.read_bytes() + footer
    return body, f"multipart/form-data; boundary={boundary}"


def upload_file(base_url: str, language: str, file_path: Path) -> dict:
    body, content_type = build_multipart_body({"language": language}, "audio", file_path)
    req = urllib.request.Request(
        f"{base_url}/api/analyze",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path, help="Directory of audio files to upload")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Web app base URL (default: %(default)s)")
    parser.add_argument("--language", default="zh", choices=["zh", "en"], help="Analysis language (default: %(default)s)")
    args = parser.parse_args()

    directory: Path = args.directory
    if not directory.is_dir():
        print(f"Not a directory: {directory}", file=sys.stderr)
        return 1

    files = sorted(
        p for p in directory.iterdir() if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS
    )
    if not files:
        print(f"No audio files ({', '.join(sorted(ALLOWED_EXTENSIONS))}) found in {directory}")
        return 0

    print(f"Found {len(files)} audio file(s). Checking already-analyzed content against {args.base_url}...")
    try:
        analyzed_ids = fetch_analyzed_audio_ids(args.base_url)
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"Failed to reach {args.base_url}: {e}", file=sys.stderr)
        return 1
    print(f"{len(analyzed_ids)} distinct track(s) already analyzed.\n")

    # Two passes: hash everything first so files needing an upload are known
    # up front — the MAX_UPLOADS_PER_RUN check below needs that count before
    # any upload starts, not discovered one at a time mid-loop.
    to_upload: list[Path] = []
    skipped = 0
    seen_digests: set[str] = set()
    for path in files:
        digest = sha256_of_file(path)
        if digest in analyzed_ids or digest in seen_digests:
            print(f"skip  {path.name}  (already analyzed)")
            skipped += 1
            continue
        seen_digests.add(digest)
        to_upload.append(path)

    if len(to_upload) > MAX_UPLOADS_PER_RUN:
        print(
            f"\n{len(to_upload)} file(s) need uploading, which is more than "
            f"MAX_UPLOADS_PER_RUN={MAX_UPLOADS_PER_RUN}. Aborting without uploading "
            f"anything — split the directory into smaller batches and run again.",
            file=sys.stderr,
        )
        return 1

    uploaded = failed = 0

    for path in to_upload:
        try:
            resp = upload_file(args.base_url, args.language, path)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            print(f"FAIL  {path.name}  HTTP {e.code}: {detail}", file=sys.stderr)
            failed += 1
            continue
        except urllib.error.URLError as e:
            print(f"FAIL  {path.name}  {e}", file=sys.stderr)
            failed += 1
            continue

        job = resp.get("data", {})
        print(f"OK    {path.name}  job_id={job.get('id')}")
        uploaded += 1

    print(f"\nDone: {uploaded} uploaded, {skipped} skipped, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
