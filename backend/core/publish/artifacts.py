import os
from typing import Iterable

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    ".tox",
}
SKIP_FILE_NAMES = {".ds_store", ".env"}
SKIP_FILE_PREFIXES = (".env.",)
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
SHEET_EXTS = {".csv", ".xlsx", ".xls"}
DOC_EXTS = {".pdf", ".md", ".docx", ".txt"}
HTML_EXTS = {".html", ".htm"}


def should_skip_rel_path(rel_path: str) -> bool:
    parts = [p for p in rel_path.replace("\\", "/").split("/") if p]
    if not parts:
        return True
    for part in parts:
        if part in SKIP_DIR_NAMES:
            return True
        if part.startswith(".") and part not in {".well-known"}:
            return True
    name = parts[-1].lower()
    if name in SKIP_FILE_NAMES or name.startswith(SKIP_FILE_PREFIXES):
        return True
    return False


def classify_rel_paths(rel_paths: Iterable[str]) -> str:
    has_site = False
    has_slides = False
    has_images = False
    has_video = False
    has_sheet = False
    has_docs = False

    for rel_path in rel_paths:
        path = rel_path.replace("\\", "/").lstrip("/")
        lower = path.lower()
        ext = os.path.splitext(lower)[1]
        if lower.endswith((".html", ".htm")):
            if "presentations/" in lower or "/slide_" in lower or lower.startswith("slide_"):
                has_slides = True
            else:
                has_site = True
        elif ext in IMAGE_EXTS:
            has_images = True
        elif ext in VIDEO_EXTS:
            has_video = True
        elif ext in SHEET_EXTS:
            has_sheet = True
        elif ext in DOC_EXTS:
            has_docs = True

    kinds = [flag for flag in (has_site, has_slides, has_images, has_video, has_sheet, has_docs) if flag]
    if len(kinds) > 1:
        if has_site and not (has_slides or has_video or has_sheet or has_docs) and has_images:
            return "site"
        if has_slides and not (has_site or has_video or has_sheet or has_docs):
            return "slides"
        return "mixed"
    if has_site:
        return "site"
    if has_slides:
        return "slides"
    if has_video:
        return "video"
    if has_sheet:
        return "sheet"
    if has_docs:
        return "docs"
    if has_images:
        return "images"
    return "mixed"


def pick_entry_html(rel_paths: list[str]) -> str | None:
    normalized = [p.replace("\\", "/").lstrip("/") for p in rel_paths]
    html_files = [p for p in normalized if os.path.splitext(p.lower())[1] in HTML_EXTS]
    if not html_files:
        return None
    for candidate in ("index.html", "index.htm"):
        if candidate in html_files:
            return candidate
    presentations = [p for p in html_files if "presentations/" in p.lower()]
    if presentations:
        presentations.sort()
        return presentations[0]
    html_files.sort()
    return html_files[0]


def public_storage_url(supabase_url: str, bucket: str, path: str) -> str:
    base = supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"
