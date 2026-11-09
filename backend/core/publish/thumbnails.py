"""Pick a publish cover image from workspace files and entry HTML."""

from __future__ import annotations

import os
import re
from typing import Iterable, Optional
from urllib.parse import unquote, urlparse

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"}

_ATTR = r"""["']([^"']+)["']"""
_OG_IMAGE_RE = re.compile(
    rf"""<meta\b[^>]*(?:property|name)\s*=\s*["']og:image["'][^>]*\bcontent\s*=\s*{_ATTR}"""
    rf"""|<meta\b[^>]*\bcontent\s*=\s*{_ATTR}[^>]*(?:property|name)\s*=\s*["']og:image["']""",
    re.I,
)
_IMG_SRC_RE = re.compile(rf"""<img\b[^>]*\bsrc\s*=\s*{_ATTR}""", re.I)
_LINK_ICON_RE = re.compile(
    rf"""<link\b[^>]*\brel\s*=\s*["'](?:apple-touch-icon(?:-precomposed)?|icon|shortcut icon)["'][^>]*\bhref\s*=\s*{_ATTR}"""
    rf"""|<link\b[^>]*\bhref\s*=\s*{_ATTR}[^>]*\brel\s*=\s*["'](?:apple-touch-icon(?:-precomposed)?|icon|shortcut icon)["']""",
    re.I,
)
_DATA_URI_RE = re.compile(r"^data:", re.I)
_TINY_ICON_HINT = re.compile(r"(?:favicon|icon[-_]?\d{0,3}|logo[-_]?mark)", re.I)


def _normalize_rel(path: str) -> str:
    cleaned = unquote((path or "").strip()).replace("\\", "/")
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    if cleaned.startswith("/"):
        cleaned = cleaned.lstrip("/")
    if cleaned.startswith("workspace/"):
        cleaned = cleaned[len("workspace/") :]
    # Drop query/hash from relative refs
    cleaned = cleaned.split("?", 1)[0].split("#", 1)[0]
    return cleaned


def _is_image_path(path: str) -> bool:
    return os.path.splitext(path.lower())[1] in IMAGE_EXTS


def _looks_like_tiny_icon(path: str) -> bool:
    name = os.path.basename(path.lower())
    return bool(_TINY_ICON_HINT.search(name)) or name in {"favicon.ico", "favicon.png", "icon.png"}


def resolve_html_ref(ref: str, rel_to_url: dict[str, str]) -> Optional[str]:
    """Map an HTML src/href to a public URL when possible."""
    if not ref or _DATA_URI_RE.match(ref):
        return None
    parsed = urlparse(ref)
    if parsed.scheme in {"http", "https"}:
        if _is_image_path(parsed.path) or "image" in (parsed.path.lower()):
            return ref
        # Absolute CDN URLs without extension still allowed for og:image
        if parsed.scheme in {"http", "https"} and not parsed.path.endswith(".svg"):
            return ref
        return None
    if parsed.scheme and parsed.scheme not in {"", "file"}:
        return None

    rel = _normalize_rel(ref)
    if not rel or rel.endswith(".svg"):
        return None
    if rel in rel_to_url:
        return rel_to_url[rel]
    # Try basename match for nested/rewritten paths
    base = os.path.basename(rel)
    for key, url in rel_to_url.items():
        if os.path.basename(key) == base and _is_image_path(key):
            return url
    return None


def extract_image_refs_from_html(html_content: str) -> list[str]:
    """Ordered candidates: og:image, <img>, then icons."""
    if not html_content:
        return []
    seen: set[str] = set()
    ordered: list[str] = []

    def add(ref: str) -> None:
        ref = (ref or "").strip()
        if not ref or ref in seen:
            return
        seen.add(ref)
        ordered.append(ref)

    for match in _OG_IMAGE_RE.finditer(html_content):
        add(next(g for g in match.groups() if g))
    for match in _IMG_SRC_RE.finditer(html_content):
        add(match.group(1))
    for match in _LINK_ICON_RE.finditer(html_content):
        add(next(g for g in match.groups() if g))
    return ordered


def pick_thumbnail_url(
    *,
    html_content: str = "",
    rel_to_url: Optional[dict[str, str]] = None,
    workspace_image_urls: Optional[Iterable[str]] = None,
    existing_thumbnail: str = "",
) -> str:
    """
    Choose the best cover URL for a published site.

    Preference: HTML og:image / content images → workspace images → prior thumbnail.
    Skips data URIs and prefers content images over favicon-sized assets.
    """
    rel_to_url = rel_to_url or {}
    workspace_image_urls = list(workspace_image_urls or [])

    html_refs = extract_image_refs_from_html(html_content)
    primary: list[str] = []
    icons: list[str] = []
    for ref in html_refs:
        url = resolve_html_ref(ref, rel_to_url)
        if not url:
            continue
        if _looks_like_tiny_icon(ref) or _looks_like_tiny_icon(urlparse(url).path):
            icons.append(url)
        else:
            primary.append(url)

    for url in primary + workspace_image_urls + icons:
        if url:
            return url
    return (existing_thumbnail or "").strip()
