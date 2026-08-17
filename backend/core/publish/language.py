import re

# Han + CJK radicals/compatibility so mixed titles like "Claude Opus 4.5 研究报告" count as zh.
_CJK_RE = re.compile(r"[\u2e80-\u2fd5\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


def detect_language(text: str | None) -> str:
    if not text or not isinstance(text, str):
        return "en"
    return "zh" if _CJK_RE.search(text) else "en"


def detect_language_from_fields(*parts: str | None) -> str:
    for part in parts:
        if part and detect_language(part) == "zh":
            return "zh"
    return "en"
