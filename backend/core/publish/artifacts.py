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


def _mtime_sort_key(value: str | None) -> float:
    """Best-effort parse of sandbox mod_time strings; unknown sorts as oldest."""
    if not value:
        return 0.0
    text = str(value).strip()
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        pass
    from datetime import datetime

    cleaned = text.replace("Z", "+00:00")
    for candidate in (cleaned, text[:19]):
        try:
            return datetime.fromisoformat(candidate).timestamp()
        except ValueError:
            continue
    return 0.0


def pick_entry_html(
    rel_paths: list[str],
    mtimes: dict[str, str] | None = None,
) -> str | None:
    """Pick the HTML entry for a published site.

    Prefers the newest index.html/htm at any depth (dedicated computers often keep
    each project in a subdirectory), then presentation slides, then other HTML.
    """
    normalized = [p.replace("\\", "/").lstrip("/") for p in rel_paths]
    html_files = [p for p in normalized if os.path.splitext(p.lower())[1] in HTML_EXTS]
    if not html_files:
        return None

    mtimes = mtimes or {}

    def rank(path: str) -> tuple:
        name = os.path.basename(path).lower()
        is_index = name in ("index.html", "index.htm")
        is_presentation = "presentations/" in path.lower() or "/slide_" in path.lower() or name.startswith("slide_")
        # Lower tuple wins: indexes first, then newest, then shallower, then name.
        return (
            0 if is_index else (1 if is_presentation else 2),
            -_mtime_sort_key(mtimes.get(path)),
            path.count("/"),
            path.lower(),
        )

    indexes = [p for p in html_files if os.path.basename(p).lower() in ("index.html", "index.htm")]
    if indexes:
        indexes.sort(key=rank)
        return indexes[0]

    presentations = [p for p in html_files if "presentations/" in p.lower() or "/slide_" in p.lower() or os.path.basename(p).lower().startswith("slide_")]
    if presentations:
        presentations.sort(key=rank)
        return presentations[0]

    html_files.sort(key=rank)
    return html_files[0]


def site_root_for_entry(entry_html: str | None) -> str:
    if not entry_html:
        return ""
    return os.path.dirname(entry_html.replace("\\", "/").lstrip("/")).strip("/")


def filter_files_for_entry(
    rel_paths: list[str],
    entry_html: str | None,
) -> list[str]:
    """Keep only files belonging to the chosen site.

    Nested entry `report/index.html` → only `report/**`.
    Root entry → keep root files and folders that are not themselves other sites
    (directories that contain their own index.html).
    """
    normalized = [p.replace("\\", "/").lstrip("/") for p in rel_paths]
    if not entry_html:
        return normalized
    entry = entry_html.replace("\\", "/").lstrip("/")
    folder = site_root_for_entry(entry)
    if folder:
        prefix = folder + "/"
        return [p for p in normalized if p == entry or p == folder or p.startswith(prefix)]

    other_site_roots: set[str] = set()
    for path in normalized:
        base = os.path.basename(path).lower()
        if base in ("index.html", "index.htm") and "/" in path:
            other_site_roots.add(path.split("/", 1)[0])

    kept: list[str] = []
    for path in normalized:
        top = path.split("/", 1)[0]
        if "/" in path and top in other_site_roots:
            continue
        kept.append(path)
    return kept


def public_storage_url(supabase_url: str, bucket: str, path: str) -> str:
    base = supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"
