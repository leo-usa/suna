'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell, systemPreferences, nativeImage, powerSaveBlocker, desktopCapturer, screen } = require('electron');
const { execFileSync, fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function runnerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'runner');
  }
  return path.join(__dirname, 'runner');
}

const { ensureWorkspace } = require(path.join(runnerDir(), 'workspace.js'));
const { runComputerAction } = require(path.join(runnerDir(), 'computer.js'));

let child = null;
let status = {
  state: 'idle',
  deviceId: null,
  previewPort: 18080,
  error: null,
};
let persist = { deviceToken: null, backendWsUrl: null, allowlist: [], allowAllCommands: true, allowComputerUse: false };
let lastMenuTemplate = [];
let stayAwakeId = null;

function keepComputerUseAwake() {
  if (stayAwakeId != null && powerSaveBlocker.isStarted(stayAwakeId)) return;
  stayAwakeId = powerSaveBlocker.start('prevent-app-suspension');
}

function persistPath() {
  return path.join(app.getPath('userData'), 'local-runner.json');
}

function claimLocalFolders() {
  const home = os.homedir();
  const docs = path.join(home, 'Documents', 'Dobby');
  try {
    fs.mkdirSync(docs, { recursive: true });
    fs.readdirSync(docs);
  } catch (err) {
    console.error('[local-runner] Documents/Dobby access failed:', err && err.message);
  }
}

function loadPersist() {
  try {
    persist = { ...persist, ...JSON.parse(fs.readFileSync(persistPath(), 'utf8')) };
  } catch (_) {
    /* first run */
  }
}

function savePersist() {
  fs.mkdirSync(path.dirname(persistPath()), { recursive: true });
  fs.writeFileSync(persistPath(), JSON.stringify(persist, null, 2));
}

function runnerScript() {
  return path.join(runnerDir(), 'index.js');
}

function runnerPids() {
  const script = runnerScript();
  try {
    const out = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    const pids = [];
    for (const line of out.split('\n')) {
      if (!line.includes(script)) continue;
      const pid = parseInt(line.trim(), 10);
      if (pid > 0 && pid !== process.pid) pids.push(pid);
    }
    return pids;
  } catch (_) {
    return [];
  }
}

function killPid(pid) {
  if (!pid) return;
  try { process.kill(pid, 'SIGKILL'); } catch (_) { /* already gone */ }
}

function killAllRunners() {
  const tracked = child;
  child = null;
  if (tracked) {
    try { tracked.send({ type: 'stop' }); } catch (_) { /* ignore */ }
    try { tracked.kill('SIGKILL'); } catch (_) { /* ignore */ }
    killPid(tracked.pid);
  }
  for (const pid of runnerPids()) killPid(pid);
}

function setStatus(partial) {
  status = { ...status, ...partial };
  if (lastMenuTemplate.length) {
    rebuildMenu(lastMenuTemplate);
  }
}

async function promptComputerUse(detail) {
  if (persist.allowComputerUse) return true;
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Dobby wants to control this Mac',
    message: 'Allow Dobby to see the screen and use the mouse and keyboard?',
    detail: String(detail || 'Screenshot, click, type, and open apps on this computer.').slice(0, 1500),
    buttons: ['Deny', 'Allow'],
    defaultId: 1,
    cancelId: 0,
  });
  if (result.response !== 1) return false;
  persist.allowComputerUse = true;
  savePersist();
  rebuildMenu();
  desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 2, height: 2 } }).catch(() => {});
  try {
    if (typeof systemPreferences.isTrustedAccessibilityClient === 'function') {
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  } catch (_) { /* ignore */ }
  return true;
}

const SCREEN_CAPTURE_HELP = 'Screen capture is not available. In System Settings → Privacy & Security → Screen & System Audio Recording, enable Dobby, then fully quit (Cmd+Q) and reopen the app.';
const ACCESSIBILITY_HELP = 'macOS Accessibility permission is required. Enable Dobby in System Settings → Privacy & Security → Accessibility, then fully quit (Cmd+Q) and reopen the app.';

function encodeScreenshot(image, screenWidth, screenHeight, scale) {
  const size = image && image.getSize ? image.getSize() : { width: 0, height: 0 };
  if (!size.width || !size.height || size.width < 32 || size.height < 32) {
    throw new Error(SCREEN_CAPTURE_HELP);
  }
  const maxWidth = 1280;
  const resized = size.width > maxWidth
    ? image.resize({ width: maxWidth, quality: 'good' })
    : image;
  const jpeg = resized.toJPEG(55);
  if (!jpeg || jpeg.length < 100) {
    throw new Error(SCREEN_CAPTURE_HELP);
  }
  const out = resized.getSize();
  return {
    png_b64: jpeg.toString('base64'),
    mime: 'image/jpeg',
    width: out.width,
    height: out.height,
    screen_width: screenWidth || out.width,
    screen_height: screenHeight || out.height,
    scale: scale || 1,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Dobby steps aside for the whole computer-use session instead of once per action,
// so the app being driven keeps the foreground and keyboard focus between steps.
const DOBBY_RESTORE_IDLE_MS = 5000;
let hiddenDobbyWindows = null;
let dobbyRestoreTimer = null;

function cancelDobbyRestore() {
  if (dobbyRestoreTimer) {
    clearTimeout(dobbyRestoreTimer);
    dobbyRestoreTimer = null;
  }
}

function hideDobby() {
  if (hiddenDobbyWindows) return false;
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed() && win.isVisible());
  if (!windows.length) return false;
  hiddenDobbyWindows = windows;
  // Hide windows only. app.hide() naps Electron, so "open done" never gets
  // back to the agent and the chat stays on Opening until the 120s timeout.
  for (const win of windows) {
    try { win.hide(); } catch (_) { /* ignore */ }
  }
  return true;
}

function restoreDobby() {
  cancelDobbyRestore();
  const windows = hiddenDobbyWindows;
  hiddenDobbyWindows = null;
  if (!windows) return;
  for (const win of windows) {
    if (win.isDestroyed()) continue;
    try { win.showInactive(); } catch (_) {
      try { win.show(); } catch (__) { /* ignore */ }
    }
  }
}

function scheduleDobbyRestore() {
  if (!hiddenDobbyWindows) return;
  cancelDobbyRestore();
  dobbyRestoreTimer = setTimeout(restoreDobby, DOBBY_RESTORE_IDLE_MS);
}

// The user brought Dobby back themselves, so forget the session and let the next
// action hide it again rather than acting while Dobby holds focus.
app.on('activate', () => {
  cancelDobbyRestore();
  hiddenDobbyWindows = null;
});

async function withDobbyHidden(fn) {
  if (hideDobby()) await delay(200);
  try {
    return await fn();
  } finally {
    scheduleDobbyRestore();
  }
}

function screenshotFromPngB64(result) {
  const img = nativeImage.createFromBuffer(Buffer.from(result.png_b64 || '', 'base64'));
  return encodeScreenshot(
    img,
    result.screen_width,
    result.screen_height,
    result.scale,
  );
}

async function captureScreenElectron() {
  const display = screen.getPrimaryDisplay();
  const scale = display.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.max(1, Math.round(display.size.width * scale)),
      height: Math.max(1, Math.round(display.size.height * scale)),
    },
  });
  const displayId = String(display.id);
  const source = sources.find((item) => String(item.display_id) === displayId) || sources[0];
  if (!source || !source.thumbnail) {
    throw new Error(SCREEN_CAPTURE_HELP);
  }
  return encodeScreenshot(source.thumbnail, display.size.width, display.size.height, scale);
}

async function captureScreen() {
  const first = app.isPackaged ? captureScreenElectron : () => runComputerAction('screenshot', {}).then(screenshotFromPngB64);
  const second = app.isPackaged ? () => runComputerAction('screenshot', {}).then(screenshotFromPngB64) : captureScreenElectron;
  try {
    return await first();
  } catch (err) {
    try {
      return await second();
    } catch (_) {
      throw err instanceof Error ? err : new Error(SCREEN_CAPTURE_HELP);
    }
  }
}

function ensureAccessibility() {
  if (process.platform !== 'darwin' || !systemPreferences.isTrustedAccessibilityClient) return true;
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (trusted) return true;
  throw new Error(ACCESSIBILITY_HELP);
}

async function handleComputerRequest(kind, payload) {
  console.log('[computer]', kind, 'start');
  try {
    if (kind === 'open') {
      const result = await withTimeout(runComputerAction('open', payload), 8000, 'open');
      console.log('[computer]', kind, 'done');
      return result;
    }
    const result = await withDobbyHidden(async () => {
      if (kind === 'screenshot') {
        return withTimeout(captureScreen(), 8000, 'screenshot');
      }
      ensureAccessibility();
      return withTimeout(runComputerAction(kind, payload), 8000, kind);
    });
    console.log('[computer]', kind, 'done');
    return result;
  } catch (err) {
    console.error('[computer]', kind, 'failed', err && err.message ? err.message : err);
    throw err;
  }
}

async function promptApproval(command) {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Dobby wants to run a command',
    message: 'Allow Dobby to run commands on this Mac?',
    detail: String(command || '').slice(0, 2000),
    buttons: ['Deny', 'Allow once', 'Allow all commands'],
    defaultId: 2,
    cancelId: 0,
  });
  if (result.response === 0) return 'deny';
  if (result.response === 2) return 'allow-all';
  return 'once';
}

function startRunner({ deviceToken, backendWsUrl }) {
  killAllRunners();
  persist.deviceToken = deviceToken || persist.deviceToken;
  persist.backendWsUrl = backendWsUrl || persist.backendWsUrl;
  savePersist();
  if (!persist.deviceToken || !persist.backendWsUrl) {
    setStatus({ state: 'error', error: 'Missing pairing token' });
    return { ok: false, error: status.error };
  }

  const runnerDir = path.dirname(runnerScript());
  const nodePath = [
    path.join(runnerDir, 'node_modules'),
    path.join(__dirname, 'node_modules'),
    process.env.NODE_PATH,
  ].filter(Boolean).join(path.delimiter);

  child = fork(runnerScript(), [], {
    cwd: runnerDir,
    detached: false,
    env: {
      ...process.env,
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      ELECTRON_RUN_AS_NODE: '1',
      DOBBY_DEVICE_TOKEN: persist.deviceToken,
      DOBBY_BACKEND_WS: persist.backendWsUrl,
      DOBBY_PREVIEW_PORT: String(status.previewPort || 18080),
      DOBBY_ALLOWLIST: (persist.allowlist || []).join('\n'),
      DOBBY_ALLOW_ALL: persist.allowAllCommands ? '1' : '0',
      NODE_PATH: nodePath,
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  const spawned = child;
  child.stdout.on('data', (buf) => console.log('[runner]', buf.toString()));
  child.stderr.on('data', (buf) => console.error('[runner]', buf.toString()));
  child.on('message', async (message) => {
    if (!message || typeof message !== 'object') return;
    if (child !== spawned) return;
    if (message.type === 'status') {
      setStatus({
        state: message.status || status.state,
        deviceId: message.deviceId || status.deviceId,
        previewPort: message.previewPort || status.previewPort,
        error: message.error || null,
      });
    }
    if (message.type === 'approval') {
      const decision = await promptApproval(message.command);
      if (child === spawned) child.send({ type: 'approval-result', requestId: message.requestId, decision });
    }
    if (message.type === 'computer-request') {
      keepComputerUseAwake();
      const allowed = await promptComputerUse(message.kind);
      if (!allowed) {
        if (child === spawned) child.send({ type: 'computer-result', requestId: message.requestId, error: 'Computer use denied' });
        return;
      }
      try {
        const result = await handleComputerRequest(message.kind, message.payload || {});
        if (child === spawned) child.send({ type: 'computer-result', requestId: message.requestId, result });
        console.log('[computer]', message.kind, 'sent');
      } catch (err) {
        if (child === spawned) child.send({ type: 'computer-result', requestId: message.requestId, error: err.message || String(err) });
      }
    }
    if (message.type === 'allow-all') {
      persist.allowAllCommands = true;
      savePersist();
      rebuildMenu();
    }
    if (message.type === 'allowlist-add' && message.shape) {
      persist.allowlist = Array.from(new Set([...(persist.allowlist || []), message.shape]));
      savePersist();
    }
  });
  child.on('exit', (code) => {
    if (child !== spawned) return;
    child = null;
    if (status.state !== 'stopped') {
      setStatus({ state: 'offline', error: code ? `Runner exited ${code}` : null });
    }
  });
  setStatus({ state: 'starting', error: null });
  return { ok: true, status };
}

function stopRunner(opts = {}) {
  setStatus({ state: 'stopped' });
  killAllRunners();
  return { ok: true, status };
}

function openWorkspace(projectId) {
  const home = os.homedir();
  const root = projectId
    ? ensureWorkspace(home, projectId)
    : path.join(home, 'Documents', 'Dobby');
  fs.mkdirSync(root, { recursive: true });
  return shell.openPath(root);
}

function toggleAllowAllCommands() {
  persist.allowAllCommands = !persist.allowAllCommands;
  savePersist();
  if (persist.deviceToken) startRunner({});
  rebuildMenu();
}

function rebuildMenu(existingTemplate) {
  if (Array.isArray(existingTemplate) && existingTemplate.length) {
    lastMenuTemplate = existingTemplate;
  }
  const source = lastMenuTemplate.length ? lastMenuTemplate : (Array.isArray(existingTemplate) ? existingTemplate : []);
  const runnerMenu = {
    label: 'Local Runner',
    submenu: [
      { label: `Status: ${status.state}`, enabled: false },
      {
        label: persist.allowAllCommands ? 'Ask before running commands' : 'Allow all commands',
        click: () => toggleAllowAllCommands(),
      },
      {
        label: persist.allowComputerUse ? 'Revoke computer control' : 'Allow computer control',
        click: () => {
          persist.allowComputerUse = !persist.allowComputerUse;
          savePersist();
          rebuildMenu();
        },
      },
      {
        label: 'Open workspace folder',
        click: () => openWorkspace(''),
      },
      {
        label: 'Reconnect',
        click: () => startRunner({}),
      },
      {
        label: 'Stop local runner',
        click: () => stopRunner(),
      },
    ],
  };
  const template = source
    .filter((item) => item.label !== 'Local Runner')
    .slice();
  const windowIndex = template.findIndex((item) => item.label === 'Window');
  if (windowIndex >= 0) template.splice(windowIndex, 0, runnerMenu);
  else template.push(runnerMenu);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  loadPersist();
  ipcMain.handle('dobby-local-connect', async (_event, payload = {}) => {
    return startRunner({
      deviceToken: payload.deviceToken,
      backendWsUrl: payload.backendWsUrl,
    });
  });
  ipcMain.handle('dobby-local-status', async () => ({
    ...status,
    hasToken: Boolean(persist.deviceToken),
  }));
  ipcMain.handle('dobby-local-stop', async () => stopRunner());
  ipcMain.handle('dobby-local-open-workspace', async (_event, projectId) => openWorkspace(projectId));
}

function autoStartIfPaired() {
  loadPersist();
  if (persist.deviceToken && persist.backendWsUrl) {
    startRunner({});
  }
}

module.exports = {
  registerIpc,
  rebuildMenu,
  autoStartIfPaired,
  startRunner,
  stopRunner,
  claimLocalFolders,
};
