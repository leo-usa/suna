from pathlib import Path

import pytest

from core.local_runner.paths import (
    WorkspaceEscapeError,
    folder_slug,
    resolve_workspace_path,
    workspace_root,
)

UUID = "85575190-23aa-4f84-a40d-62a6fbf9926e"


def test_workspace_root_nests_under_documents_dobby(tmp_path: Path):
    root = workspace_root(tmp_path, "proj_abc")
    assert root == (tmp_path / "Documents" / "Dobby" / "proj_abc").resolve()


def test_workspace_root_uses_readable_slug_when_named(tmp_path: Path):
    root = workspace_root(tmp_path, UUID, "Deepseek harness research")
    assert root == (tmp_path / "Documents" / "Dobby" / "Deepseek-harness-research-85575190").resolve()
    assert folder_slug("深度研究", UUID) == "深度研究-85575190"
    assert folder_slug('a/b:*?"<>|c', UUID) == "a-b-c-85575190"


def test_workspace_root_reuses_existing_uuid_folder(tmp_path: Path):
    uuid_folder = tmp_path / "Documents" / "Dobby" / UUID
    uuid_folder.mkdir(parents=True)
    assert workspace_root(tmp_path, UUID, "Deepseek harness research") == uuid_folder.resolve()


def test_workspace_root_prefers_readable_folder_if_both_exist(tmp_path: Path):
    uuid_folder = tmp_path / "Documents" / "Dobby" / UUID
    slug_folder = tmp_path / "Documents" / "Dobby" / "Deepseek-harness-research-85575190"
    uuid_folder.mkdir(parents=True)
    slug_folder.mkdir(parents=True)
    assert workspace_root(tmp_path, UUID, "Deepseek harness research") == slug_folder.resolve()


def test_legacy_home_dobby_is_reused(tmp_path: Path):
    legacy = tmp_path / "Dobby" / "proj_abc"
    legacy.mkdir(parents=True)
    assert workspace_root(tmp_path, "proj_abc") == legacy.resolve()


def test_resolve_workspace_path_strips_prefix(tmp_path: Path):
    target = resolve_workspace_path(tmp_path, "proj_abc", "/workspace/index.html")
    assert target == (tmp_path / "Documents" / "Dobby" / "proj_abc" / "index.html").resolve()


def test_nested_workspace_cwd_maps_to_project_root(tmp_path: Path):
    root = tmp_path / "Documents" / "Dobby" / "proj_abc"
    assert resolve_workspace_path(tmp_path, "proj_abc", "/workspace/workspace") == root.resolve()
    assert (
        resolve_workspace_path(tmp_path, "proj_abc", "/workspace/workspace/index.html")
        == (root / "index.html").resolve()
    )


def test_tmp_paths_stay_inside_workspace(tmp_path: Path):
    target = resolve_workspace_path(tmp_path, "proj_abc", "/tmp/git_file")
    assert target == (tmp_path / "Documents" / "Dobby" / "proj_abc" / "tmp" / "git_file").resolve()


def test_home_files_are_allowed(tmp_path: Path):
    notes = tmp_path / "Documents" / "notes.txt"
    notes.parent.mkdir(parents=True)
    notes.write_text("hi")
    assert resolve_workspace_path(tmp_path, "proj_abc", str(notes)) == notes.resolve()


def test_sensitive_and_outside_home_are_rejected(tmp_path: Path):
    with pytest.raises(WorkspaceEscapeError):
        resolve_workspace_path(tmp_path, "proj_abc", str(tmp_path / ".ssh" / "id_rsa"))
    with pytest.raises(WorkspaceEscapeError):
        resolve_workspace_path(tmp_path, "proj_abc", "/etc/passwd")


@pytest.mark.parametrize("project_id", ["", ".", "..", "a/b", "a\\b"])
def test_invalid_project_ids(tmp_path: Path, project_id: str):
    with pytest.raises(WorkspaceEscapeError):
        workspace_root(tmp_path, project_id)
