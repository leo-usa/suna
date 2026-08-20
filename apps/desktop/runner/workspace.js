'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

class WorkspaceEscapeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkspaceEscapeError';
  }
}

const SENSITIVE_SEGMENTS = new Set(['.ssh', '.aws', '.gnupg', '.netrc']);

function isSensitive(resolved) {
  const parts = resolved.split(path.sep);
  if (parts.some((part) => SENSITIVE_SEGMENTS.has(part))) return true;
  const text = resolved.toLowerCase();
  return text.includes(`${path.sep}keychains${path.sep}`) || text.includes('1password') || text.includes(`${path.sep}.config${path.sep}op`);
}

function under(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertProjectId(projectId) {
  if (!projectId || projectId.includes('/') || projectId.includes('\\') || projectId === '.' || projectId === '..') {
    throw new WorkspaceEscapeError('Invalid project id');
  }
}

function shortProjectId(projectId) {
  const first = String(projectId).split('-')[0].replace(/[^a-zA-Z0-9\u00C0-\u024F\u4e00-\u9fff]/g, '');
  if (first.length >= 6) return first.slice(0, 8);
  return String(projectId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'project';
}

function folderSlug(name, projectId) {
  assertProjectId(projectId);
  let base = String(name || '').trim();
  base = base.replace(/[\/\\:*?"<>|]/g, ' ');
  base = base.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[.-]+$/g, '');
  if (base.length > 60) base = base.slice(0, 60).replace(/-+$/g, '');
  if (!base) base = 'Project';
  return `${base}-${shortProjectId(projectId)}`;
}

function isProjectFolderName(name, projectId) {
  if (name === projectId) return true;
  const suffix = `-${shortProjectId(projectId)}`;
  return name.endsWith(suffix);
}

function dobbyRoots(home) {
  const resolvedHome = path.resolve(home || os.homedir());
  return [
    path.resolve(path.join(resolvedHome, 'Documents', 'Dobby')),
    path.resolve(path.join(resolvedHome, 'Dobby')),
  ];
}

function listProjectFolders(home, projectId) {
  assertProjectId(projectId);
  const found = [];
  const seen = new Set();
  for (const parent of dobbyRoots(home)) {
    let names = [];
    try {
      names = fs.readdirSync(parent);
    } catch (_) {
      names = [];
    }
    if (!names.includes(projectId) && fs.existsSync(path.join(parent, projectId))) {
      names.push(projectId);
    }
    for (const name of names) {
      if (!isProjectFolderName(name, projectId)) continue;
      const folder = path.resolve(path.join(parent, name));
      if (path.dirname(folder) !== parent || seen.has(folder)) continue;
      try {
        const stat = fs.lstatSync(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
      } catch (_) {
        continue;
      }
      seen.add(folder);
      found.push(folder);
    }
  }
  return found;
}

function desiredProjectFolder(home, projectId, projectName) {
  const parent = dobbyRoots(home)[0];
  const name = projectName ? folderSlug(projectName, projectId) : projectId;
  return path.resolve(path.join(parent, name));
}

function workspaceRoot(home, projectId, projectName) {
  assertProjectId(projectId);
  const existing = listProjectFolders(home, projectId);
  if (!existing.length) return desiredProjectFolder(home, projectId, projectName);
  const desired = desiredProjectFolder(home, projectId, projectName);
  return existing.find((folder) => folder === desired) || existing[0];
}

function assertAllowed(home, resolved, virtualPath) {
  const homeRoot = path.resolve(home || os.homedir());
  if (!under(homeRoot, resolved)) {
    throw new WorkspaceEscapeError(`Path is outside your home folder: ${virtualPath}`);
  }
  if (isSensitive(resolved)) {
    throw new WorkspaceEscapeError(`Refuses a sensitive path: ${virtualPath}`);
  }
}

function stripWorkspacePrefix(virtualPath) {
  let raw = virtualPath || '';
  if (!raw.startsWith('/workspace')) return raw;
  raw = raw.slice('/workspace'.length).replace(/^[/\\]+/, '');
  if (raw === 'workspace' || raw.startsWith('workspace/') || raw.startsWith('workspace\\')) {
    raw = raw.slice('workspace'.length).replace(/^[/\\]+/, '');
  }
  return raw;
}

function rewriteWorkspaceCommand(command, projectRoot) {
  if (!command) return command;
  return String(command).replace(/\/workspace(?:\/workspace)?(?=\/|$|[\s"'`;|&)])/g, String(projectRoot));
}

function resolveWorkspacePath(home, projectId, virtualPath, projectName) {
  const root = workspaceRoot(home, projectId, projectName);
  const homeRoot = path.resolve(home || os.homedir());
  let raw = virtualPath || '';

  if (raw.startsWith('/workspace')) {
    raw = stripWorkspacePrefix(raw);
    const resolved = raw ? path.resolve(path.join(root, raw)) : root;
    assertAllowed(homeRoot, resolved, virtualPath);
    return resolved;
  }

  if (raw === '/tmp' || raw.startsWith('/tmp/') || raw.startsWith('/tmp\\')) {
    const rest = raw.slice('/tmp'.length).replace(/^[/\\]+/, '');
    const tmpRoot = path.join(root, 'tmp');
    return rest ? path.resolve(path.join(tmpRoot, rest)) : path.resolve(tmpRoot);
  }

  if (raw.startsWith('~')) {
    const resolved = path.resolve(raw.replace(/^~(?=$|[/\\])/, homeRoot));
    assertAllowed(homeRoot, resolved, virtualPath);
    return resolved;
  }

  if (path.isAbsolute(raw)) {
    const resolved = path.resolve(raw);
    assertAllowed(homeRoot, resolved, virtualPath);
    return resolved;
  }

  const resolved = raw ? path.resolve(path.join(root, raw)) : root;
  assertAllowed(homeRoot, resolved, virtualPath);
  return resolved;
}

function ensureWorkspace(home, projectId, projectName) {
  const desired = desiredProjectFolder(home, projectId, projectName);
  const existing = listProjectFolders(home, projectId);
  const alreadyDesired = existing.find((folder) => folder === desired);
  if (alreadyDesired) {
    fs.mkdirSync(alreadyDesired, { recursive: true });
    return alreadyDesired;
  }
  if (existing.length) {
    const current = existing[0];
    if (projectName && current !== desired && !fs.existsSync(desired)) {
      try {
        fs.mkdirSync(path.dirname(desired), { recursive: true });
        fs.renameSync(current, desired);
        return desired;
      } catch (_) {
        fs.mkdirSync(current, { recursive: true });
        return current;
      }
    }
    fs.mkdirSync(current, { recursive: true });
    return current;
  }
  fs.mkdirSync(desired, { recursive: true });
  return desired;
}

function deleteProjectWorkspace(home, projectId) {
  const deleted = [];
  for (const folder of listProjectFolders(home, projectId)) {
    const parent = path.dirname(folder);
    if (!dobbyRoots(home).includes(parent)) continue;
    fs.rmSync(folder, { recursive: true, force: true });
    deleted.push(folder);
  }
  return { deleted: deleted.length > 0, paths: deleted };
}

module.exports = {
  WorkspaceEscapeError,
  shortProjectId,
  folderSlug,
  listProjectFolders,
  workspaceRoot,
  resolveWorkspacePath,
  rewriteWorkspaceCommand,
  ensureWorkspace,
  deleteProjectWorkspace,
  dobbyRoots,
};
