import re
import unicodedata

_SLUG_UNSAFE_RE = re.compile(
    r"[^a-z0-9\u2e80-\u2fd5\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+",
    re.IGNORECASE,
)


def slugify_title(title: str | None, fallback: str = "work") -> str:
    text = unicodedata.normalize("NFKC", (title or "").strip()).lower()
    slug = _SLUG_UNSAFE_RE.sub("-", text)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if len(slug) > 80:
        slug = slug[:80].rstrip("-")
    return slug or fallback
