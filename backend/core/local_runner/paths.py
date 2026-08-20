"""Map /workspace onto ~/Documents/Dobby/<readable-name> and allow other home files."""

from __future__ import annotations

from pathlib import Path
import re

SENSITIVE_NAMES = {".ssh", ".aws", ".gnupg", ".netrc"}
UNSAFE_FOLDER_CHARS = re.compile(r'[\/\\:*?"<>|]')
WHITESPACE = re.compile(r"\s+")
MULTI_DASH = re.compile(r"-{2,}")


class WorkspaceEscapeError(ValueError):
    pass


def _is_sensitive(resolved: Path) -> bool:
    if any(part in SENSITIVE_NAMES for part in resolved.parts):
        return True
    text = str(resolved).lower().replace("\\", "/")
    return "keychains" in text or "1password" in text or "/.config/op" in text


def _assert_project_id(project_id: str) -> None:
    if not project_id or "/" in project_id or "\\" in project_id or project_id in {".", ".."}:
        raise WorkspaceEscapeError("Invalid project id")


def short_project_id(project_id: str) -> str:
    first = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]", "", str(project_id).split("-")[0])
    if len(first) >= 6:
        return first[:8]
    compact = re.sub(r"[^0-9A-Za-z]", "", str(project_id))
    return (compact[:8] or "project")


def folder_slug(name: str | None, project_id: str) -> str:
    _assert_project_id(project_id)
    base = UNSAFE_FOLDER_CHARS.sub(" ", str(name or "")).strip()
    base = MULTI_DASH.sub("-", WHITESPACE.sub("-", base)).strip(".-")
    if len(base) > 60:
        base = base[:60].rstrip("-")
    if not base:
        base = "Project"
    return f"{base}-{short_project_id(project_id)}"


def _is_project_folder_name(name: str, project_id: str) -> bool:
    if name == project_id:
        return True
    return name.endswith(f"-{short_project_id(project_id)}")


def dobby_roots(home: str | Path) -> list[Path]:
    home_path = Path(home).expanduser().resolve()
    return [home_path / "Documents" / "Dobby", home_path / "Dobby"]


def list_project_folders(home: str | Path, project_id: str) -> list[Path]:
    _assert_project_id(project_id)
    found: list[Path] = []
    seen: set[Path] = set()
    for parent in dobby_roots(home):
        try:
            names = [p.name for p in parent.iterdir()] if parent.exists() else []
        except OSError:
            names = []
        uuid_path = parent / project_id
        if uuid_path.exists() and project_id not in names:
            names.append(project_id)
        for name in names:
            if not _is_project_folder_name(name, project_id):
                continue
            folder = (parent / name).resolve()
            if folder.parent != parent.resolve() or folder in seen:
                continue
            if not folder.is_dir() or folder.is_symlink():
                continue
            seen.add(folder)
            found.append(folder)
    return found


def desired_project_folder(home: str | Path, project_id: str, project_name: str | None = None) -> Path:
    parent = dobby_roots(home)[0]
    name = folder_slug(project_name, project_id) if project_name else project_id
    return (parent / name).resolve()


def workspace_root(home: str | Path, project_id: str, project_name: str | None = None) -> Path:
    existing = list_project_folders(home, project_id)
    if not existing:
        return desired_project_folder(home, project_id, project_name)
    desired = desired_project_folder(home, project_id, project_name)
    return next((folder for folder in existing if folder == desired), existing[0])


def _assert_allowed(home: Path, resolved: Path, virtual_path: str) -> None:
    try:
        resolved.relative_to(home)
    except ValueError as exc:
        raise WorkspaceEscapeError(f"Path is outside your home folder: {virtual_path}") from exc
    if _is_sensitive(resolved):
        raise WorkspaceEscapeError(f"Refuses a sensitive path: {virtual_path}")


def resolve_workspace_path(
    home: str | Path, project_id: str, virtual_path: str, project_name: str | None = None
) -> Path:
    home_path = Path(home).expanduser().resolve()
    root = workspace_root(home, project_id, project_name)
    raw = virtual_path or ""
    if raw.startswith("/workspace"):
        remainder = raw[len("/workspace") :].lstrip("/").lstrip("\\")
        if remainder == "workspace" or remainder.startswith("workspace/") or remainder.startswith("workspace\\"):
            remainder = remainder[len("workspace") :].lstrip("/").lstrip("\\")
        resolved = (root / remainder).resolve() if remainder else root
        _assert_allowed(home_path, resolved, virtual_path)
        return resolved
    if raw == "/tmp" or raw.startswith("/tmp/") or raw.startswith("/tmp\\"):
        rest = raw[len("/tmp") :].lstrip("/").lstrip("\\")
        tmp = root / "tmp"
        return (tmp / rest).resolve() if rest else tmp.resolve()
    if raw.startswith("~"):
        resolved = Path(raw).expanduser().resolve()
        _assert_allowed(home_path, resolved, virtual_path)
        return resolved
    if raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
        resolved = Path(raw).resolve()
        _assert_allowed(home_path, resolved, virtual_path)
        return resolved
    resolved = (root / raw).resolve() if raw else root
    _assert_allowed(home_path, resolved, virtual_path)
    return resolved
