"""Dobby brand badge injected into free-tier published HTML."""

from __future__ import annotations

import re

BADGE_MARKER = "data-dobby-publish-badge"

BADGE_HTML = f"""
<style id="dobby-publish-badge-style">
  [{BADGE_MARKER}]{{
    position:fixed;right:16px;bottom:16px;z-index:2147483646;
    display:inline-flex;align-items:center;gap:8px;
    padding:8px 12px;border-radius:999px;
    background:#111;color:#fff;font:600 12px/1.2 system-ui,-apple-system,sans-serif;
    text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.25);
    opacity:.92;transition:opacity .15s ease,transform .15s ease;
  }}
  [{BADGE_MARKER}]:hover{{opacity:1;transform:translateY(-1px)}}
  [{BADGE_MARKER}] img{{width:16px;height:16px;border-radius:4px}}
</style>
<a {BADGE_MARKER} href="https://dobby.now/?utm_source=published_site&utm_medium=badge&utm_campaign=sites_v1" target="_blank" rel="noopener noreferrer">
  <img src="https://dobby.now/favicon.png" alt="" width="16" height="16"/>
  Made with Dobby
</a>
"""


def inject_dobby_badge(html_content: str) -> str:
    """Insert the Made-with-Dobby badge once before </body> (or at end)."""
    if not html_content:
        return html_content
    if "dobby-publish-badge-style" in html_content:
        return html_content
    if re.search(r"</body\s*>", html_content, re.I):
        return re.sub(r"</body\s*>", BADGE_HTML + "</body>", html_content, count=1, flags=re.I)
    return html_content + BADGE_HTML


def strip_dobby_badge(html_content: str) -> str:
    if not html_content or BADGE_MARKER not in html_content:
        return html_content
    html_content = re.sub(
        r'<style id="dobby-publish-badge-style">[\s\S]*?</style>',
        "",
        html_content,
        count=1,
        flags=re.I,
    )
    html_content = re.sub(
        rf'<a[^>]*{BADGE_MARKER}[^>]*>[\s\S]*?</a>',
        "",
        html_content,
        count=1,
        flags=re.I,
    )
    return html_content
