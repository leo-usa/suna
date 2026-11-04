'use strict';

/**
 * Copy the current-platform agent-desktop native binaries into vendor/
 * so electron-builder can ship them without requiring end users to have npm.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcBin = path.join(root, 'node_modules', 'agent-desktop', 'bin');
const dest = path.join(root, 'vendor', 'agent-desktop');

const PLATFORM_FILES = {
  'darwin-arm64': ['agent-desktop-darwin-arm64', 'agent-desktop-macos-helper-darwin-arm64'],
  'darwin-x64': ['agent-desktop-darwin-x64', 'agent-desktop-macos-helper-darwin-x64'],
  'win32-x64': ['agent-desktop-win32-x64.exe'],
  'win32-arm64': ['agent-desktop-win32-arm64.exe'],
  'linux-x64': ['agent-desktop-linux-x64', 'agent-desktop-linux-clipboard-owner-linux-x64'],
  'linux-arm64': ['agent-desktop-linux-arm64', 'agent-desktop-linux-clipboard-owner-linux-arm64'],
};

function main() {
  const key = `${process.platform}-${process.arch}`;
  const files = PLATFORM_FILES[key];
  if (!files) {
    console.warn(`[stage-agent-desktop] unsupported platform ${key}; skipping`);
    return;
  }
  if (!fs.existsSync(srcBin)) {
    console.warn(
      '[stage-agent-desktop] node_modules/agent-desktop missing. Run npm install in apps/desktop first.',
    );
    return;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  let copied = 0;
  for (const name of files) {
    const from = path.join(srcBin, name);
    if (!fs.existsSync(from)) {
      console.warn(`[stage-agent-desktop] missing ${name}`);
      continue;
    }
    const to = path.join(dest, name);
    fs.copyFileSync(from, to);
    try {
      fs.chmodSync(to, 0o755);
    } catch (_) {
      /* windows */
    }
    copied += 1;
    console.log(`[stage-agent-desktop] ${name}`);
  }

  if (!copied) {
    console.warn('[stage-agent-desktop] nothing copied; packaged AX computer-use will be unavailable');
  } else {
    console.log(`[stage-agent-desktop] staged ${copied} file(s) -> vendor/agent-desktop`);
  }
}

main();
