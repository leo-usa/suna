#!/usr/bin/env python3
"""Rebrand Dobby -> Dobby in text files; leaves protected lines untouched."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIR_NAMES = frozenset(
    {"node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv", "venv", "coverage", ".turbo"}
)
SKIP_PATH_PARTS = frozenset({"migrations", ".github"})
TEXT_SUFFIXES = frozenset(
    {
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".py",
        ".html", ".css", ".yml", ".yaml", ".toml", ".txt", ".svg",
    }
)

PROTECT_IF_LINE_CONTAINS = (
    "kortix-ai",
    "Kortix-ai",
    "ghcr.io/kortix",
    "github.com/kortix",
    "github.com/Kortix",
    "app.pulumi.com/kortix",
    "api.kortix.com",
    "dev-api.kortix.com",
    "staging-api.kortix.com",
    "is_kortix_team",
    "kortix_template_id",
)

REPLACE_ORDER: list[tuple[str, str]] = [
    ("useDobbyComputerStore", "useDobbyComputerStore"),
    ("DobbyComputerHeader", "DobbyComputerHeader"),
    ("DobbyComputer", "DobbyComputer"),
    ("DobbyLoader", "DobbyLoader"),
    ("DobbyLogo", "DobbyLogo"),
    ("DobbyStep", "DobbyStep"),
    ("DobbyConfig", "DobbyConfig"),
    ("DobbySun", "DobbySun"),
    ("Dobby Team", "Dobby Team"),
    ("Dobby Sun", "Dobby Sun"),
    ("DOBBY_ADMIN_API_KEY", "DOBBY_ADMIN_API_KEY"),
    ("dobby-computer-store", "dobby-computer-store"),
    ("dobby-computer", "dobby-computer"),
    ("dobby-loader", "dobby-loader"),
    ("dobby-logo", "dobby-logo"),
    ("dobby-spreadsheet", "dobby-spreadsheet"),
    ("dobby-app-banners", "dobby-app-banners"),
    ("dobby/reusables", "dobby/reusables"),
    ("/dobby-", "/dobby-"),
    ("dobby://", "dobby://"),
    ("dobby.com", "dobby.com"),
    ("@dobby", "@dobby"),
    ("dobby/", "dobby/"),
    ("from setup.steps.kortix import DobbyStep", "from setup.steps.dobby import DobbyStep"),
    ("from .dobby.dobby import Dobby", "from .dobby.dobby import Dobby"),
    ("from .dobby.tools import", "from .dobby.tools import"),
    ('"dobby", "Dobby Admin Key"', '"dobby", "Dobby Admin Key"'),
    ("self.config.dobby.", "self.config.dobby."),
    ("config.dobby.", "config.dobby."),
    ("getattr(self, 'dobby')", "getattr(self, 'dobby')"),
    ('{"dobby":', '{"dobby":'),
    ('"dobby": {', '"dobby": {'),
    ("optional_steps = [\"morph\", \"search_apis\", \"rapidapi\", \"kortix\", \"webhook\", \"mcp\"]",
     'optional_steps = ["morph", "search_apis", "rapidapi", "dobby", "webhook", "mcp"]'),
    ("depends_on = [\"supabase\", \"daytona\", \"composio\", \"kortix\"]",
     'depends_on = ["supabase", "daytona", "composio", "dobby"]'),
    ("depends_on: list[str] = [\"supabase\", \"daytona\", \"composio\", \"kortix\"]",
     'depends_on: list[str] = ["supabase", "daytona", "composio", "dobby"]'),
    ("    dobby: DobbyConfig = Field(default_factory=DobbyConfig)",
     "    dobby: DobbyConfig = Field(default_factory=DobbyConfig)"),
    ('            "dobby",', '            "dobby",'),
]


def skip_file(rel: Path) -> bool:
    if rel.name in {"pnpm-lock.yaml", "package-lock.json"}:
        return True
    if SKIP_PATH_PARTS & set(rel.parts):
        return True
    return False


def transform_line(line: str) -> str:
    if any(p in line for p in PROTECT_IF_LINE_CONTAINS):
        return line
    seg = line
    for old, new in REPLACE_ORDER:
        seg = seg.replace(old, new)
    seg = re.sub(r"\bKortix\b", "Dobby", seg)
    return seg


def main() -> None:
    import subprocess

    listed = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).split(b"\0")
    changed = 0
    for raw_path in sorted(listed):
        if not raw_path:
            continue
        rel = Path(raw_path.decode())
        path = ROOT / rel
        if not path.is_file():
            continue
        if skip_file(rel):
            continue
        if any(p in SKIP_DIR_NAMES for p in rel.parts):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        lines = raw.splitlines(keepends=True)
        new_lines = [transform_line(L) for L in lines]
        new = "".join(new_lines)
        new = new.replace(
            '"composio",\n            "dobby",',
            '"composio",\n            "dobby",',
        )
        if new != raw:
            path.write_text(new, encoding="utf-8")
            print(rel)
            changed += 1
    print("files changed:", changed)


if __name__ == "__main__":
    main()
