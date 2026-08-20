const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('os');
const path = require('path');
const {
  workspaceRoot,
  resolveWorkspacePath,
  rewriteWorkspaceCommand,
  deleteProjectWorkspace,
  ensureWorkspace,
  folderSlug,
  WorkspaceEscapeError,
} = require('./workspace');

describe('workspace path mapping', () => {
  const home = path.join(os.tmpdir(), `dobby-home-${process.pid}`);
  const projectId = 'proj_abc';
  const uuid = '85575190-23aa-4f84-a40d-62a6fbf9926e';

  it('maps /workspace onto ~/Documents/Dobby/<project>', () => {
    const root = workspaceRoot(home, projectId);
    assert.equal(root, path.resolve(path.join(home, 'Documents', 'Dobby', projectId)));
    assert.equal(resolveWorkspacePath(home, projectId, '/workspace'), root);
    assert.equal(resolveWorkspacePath(home, projectId, '/workspace/workspace'), root);
    assert.equal(
      resolveWorkspacePath(home, projectId, '/workspace/index.html'),
      path.resolve(path.join(root, 'index.html')),
    );
    assert.equal(
      resolveWorkspacePath(home, projectId, '/workspace/workspace/index.html'),
      path.resolve(path.join(root, 'index.html')),
    );
  });

  it('uses a readable folder name when a project title is provided', () => {
    const root = workspaceRoot(home, uuid, 'Deepseek harness research');
    assert.equal(
      root,
      path.resolve(path.join(home, 'Documents', 'Dobby', 'Deepseek-harness-research-85575190')),
    );
    assert.equal(folderSlug('深度研究', uuid), '深度研究-85575190');
    assert.equal(folderSlug('a/b:*?"<>|c', uuid), 'a-b-c-85575190');
  });

  it('maps /tmp into the workspace tmp folder', () => {
    assert.equal(
      resolveWorkspacePath(home, projectId, '/tmp/git_file'),
      path.resolve(path.join(home, 'Documents', 'Dobby', projectId, 'tmp', 'git_file')),
    );
  });

  it('allows other files under the user home folder', () => {
    const notes = path.join(home, 'Documents', 'notes.txt');
    assert.equal(resolveWorkspacePath(home, projectId, notes), path.resolve(notes));
  });

  it('rejects sensitive paths, escapes, and bad project ids', () => {
    assert.throws(() => resolveWorkspacePath(home, projectId, path.join(home, '.ssh', 'id_rsa')), WorkspaceEscapeError);
    assert.throws(() => resolveWorkspacePath(home, projectId, '/etc/passwd'), WorkspaceEscapeError);
    assert.throws(() => workspaceRoot(home, '../etc'), WorkspaceEscapeError);
    assert.throws(() => workspaceRoot(home, 'a/b'), WorkspaceEscapeError);
  });

  it('rewrites /workspace paths inside shell commands', () => {
    const root = '/Users/leo/Documents/Dobby/proj_abc';
    assert.equal(rewriteWorkspaceCommand('ls /workspace', root), `ls ${root}`);
    assert.equal(rewriteWorkspaceCommand('cat /workspace/workspace/index.html', root), `cat ${root}/index.html`);
    assert.equal(
      rewriteWorkspaceCommand('python3 /workspace/temp_create_email_summary.py', root),
      `python3 ${root}/temp_create_email_summary.py`,
    );
    assert.equal(
      rewriteWorkspaceCommand('cd /workspace/workspace; python3 /workspace/temp.py', root),
      `cd ${root}; python3 ${root}/temp.py`,
    );
    assert.equal(rewriteWorkspaceCommand('echo /workspaces', root), 'echo /workspaces');
  });

  it('reuses a legacy ~/Dobby project folder if it already exists', () => {
    const legacyHome = path.join(os.tmpdir(), `dobby-legacy-${process.pid}`);
    const legacy = path.join(legacyHome, 'Dobby', projectId);
    fs.mkdirSync(legacy, { recursive: true });
    assert.equal(workspaceRoot(legacyHome, projectId), path.resolve(legacy));
  });

  it('renames a UUID folder once a title is available', () => {
    const renameHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-rename-'));
    const uuidFolder = path.join(renameHome, 'Documents', 'Dobby', uuid);
    fs.mkdirSync(uuidFolder, { recursive: true });
    fs.writeFileSync(path.join(uuidFolder, 'note.txt'), 'hello');
    const next = ensureWorkspace(renameHome, uuid, 'Deepseek harness research');
    const expected = path.resolve(path.join(renameHome, 'Documents', 'Dobby', 'Deepseek-harness-research-85575190'));
    assert.equal(next, expected);
    assert.equal(fs.existsSync(uuidFolder), false);
    assert.equal(fs.readFileSync(path.join(expected, 'note.txt'), 'utf8'), 'hello');
  });

  it('prefers the readable folder if both UUID and slug folders exist', () => {
    const bothHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-both-'));
    const uuidFolder = path.join(bothHome, 'Documents', 'Dobby', uuid);
    const slugFolder = path.join(bothHome, 'Documents', 'Dobby', 'Deepseek-harness-research-85575190');
    fs.mkdirSync(uuidFolder, { recursive: true });
    fs.mkdirSync(slugFolder, { recursive: true });
    assert.equal(
      workspaceRoot(bothHome, uuid, 'Deepseek harness research'),
      path.resolve(slugFolder),
    );
  });

  it('deletes only the project folder under Dobby roots', () => {
    const delHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-del-'));
    const folder = path.join(delHome, 'Documents', 'Dobby', projectId);
    fs.mkdirSync(path.join(folder, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'nested', 'note.txt'), 'keep-me-not');
    const sibling = path.join(delHome, 'Documents', 'Dobby', 'other_proj');
    fs.mkdirSync(sibling, { recursive: true });
    const result = deleteProjectWorkspace(delHome, projectId);
    assert.equal(result.deleted, true);
    assert.equal(fs.existsSync(folder), false);
    assert.equal(fs.existsSync(sibling), true);
    assert.throws(() => deleteProjectWorkspace(delHome, '../etc'), WorkspaceEscapeError);
  });

  it('deletes both UUID and readable project folders', () => {
    const delHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-del-slug-'));
    const uuidFolder = path.join(delHome, 'Documents', 'Dobby', uuid);
    const slugFolder = path.join(delHome, 'Documents', 'Dobby', 'Deepseek-harness-research-85575190');
    const sibling = path.join(delHome, 'Documents', 'Dobby', 'other-85575191');
    fs.mkdirSync(uuidFolder, { recursive: true });
    fs.mkdirSync(slugFolder, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    const result = deleteProjectWorkspace(delHome, uuid);
    assert.equal(result.deleted, true);
    assert.equal(fs.existsSync(uuidFolder), false);
    assert.equal(fs.existsSync(slugFolder), false);
    assert.equal(fs.existsSync(sibling), true);
  });
});
