'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function unixPathExtras() {
  return ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
}

function windowsPathExtras() {
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  return [
    'C:\\Program Files\\Git\\cmd',
    'C:\\Program Files\\Git\\bin',
    'C:\\Program Files\\nodejs',
    path.join(local, 'Programs', 'Python'),
    path.join(local, 'Programs', 'Microsoft VS Code', 'bin'),
    path.join(roaming, 'npm'),
  ].filter(Boolean);
}

function shellPath() {
  const extras = process.platform === 'win32' ? windowsPathExtras() : unixPathExtras();
  const parts = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const extra of extras) {
    if (extra && !parts.includes(extra)) parts.push(extra);
  }
  return parts.join(path.delimiter);
}

function resolveBin(name, envPath) {
  const dirs = String(envPath || shellPath()).split(path.delimiter);
  const names = process.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name];
  for (const dir of dirs) {
    for (const candidateName of names) {
      const candidate = path.join(dir, candidateName);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      } catch (_) { /* ignore */ }
    }
  }
  return null;
}

function versionOf(bin) {
  if (!bin) return null;
  try {
    const out = execFileSync(bin, ['--version'], {
      timeout: 3000,
      encoding: 'utf8',
      env: { ...process.env, PATH: shellPath() },
    });
    return String(out || '').trim().split('\n')[0] || null;
  } catch (_) {
    return null;
  }
}

function probeHostTools() {
  const python = resolveBin('python3') || resolveBin('python');
  const node = resolveBin('node');
  const git = resolveBin('git');
  return {
    python: python ? { path: python, version: versionOf(python) } : null,
    node: node ? { path: node, version: versionOf(node) } : null,
    git: git ? { path: git, version: versionOf(git) } : null,
  };
}

function firstToken(command) {
  const trimmed = String(command || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^["']/, '').split(/[\s;/|&]+/)[0] || '';
}

function missingToolHint(command, stderr) {
  const text = `${stderr || ''}`;
  const token = firstToken(command).replace(/^.*[\\/]/, '');
  const missing = /command not found|not found|is not recognized as an internal or external command/i.test(text);
  if (!missing) return '';
  const host = process.platform === 'win32' ? 'this computer' : 'this Mac';
  const quit = process.platform === 'win32' ? 'fully quit Dobby and reopen' : 'fully quit Dobby (Cmd+Q) and reopen';
  if (token === 'python3' || token === 'python' || /\bpython3?: command not found/i.test(text)) {
    const install = process.platform === 'win32'
      ? 'Install Python 3.11+ from https://www.python.org/downloads/windows/ and tick "Add python.exe to PATH"'
      : 'Install Python 3.11+ from https://www.python.org/downloads/macos/ or run `brew install python`';
    return `Python 3 was not found on ${host}. ${install}, then ${quit}. Or turn off "Run on this computer" to use the cloud sandbox.\n`;
  }
  if (token === 'node' || token === 'npm' || token === 'npx' || /\bnode: command not found/i.test(text)) {
    const install = process.platform === 'win32'
      ? 'Install it from https://nodejs.org/'
      : 'Install it from https://nodejs.org/ or `brew install node`';
    return `Node.js was not found on ${host}. ${install}, then quit and reopen Dobby. Or turn off "Run on this computer" to use the cloud sandbox.\n`;
  }
  if (token === 'git' || /\bgit: command not found/i.test(text)) {
    const install = process.platform === 'win32'
      ? 'Install Git from https://git-scm.com/download/win'
      : 'Install Xcode Command Line Tools (`xcode-select --install`) or `brew install git`';
    return `Git was not found on ${host}. ${install}, then quit and reopen Dobby.\n`;
  }
  return '';
}

module.exports = {
  shellPath,
  resolveBin,
  probeHostTools,
  missingToolHint,
};
