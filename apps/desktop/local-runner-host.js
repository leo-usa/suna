'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell, systemPreferences, nativeImage } = require('electron');
const { fork } = require('child_process');
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
let persist = { deviceToken: null, backendWsUrl: null, allowlist: [], allowAllCommands: false, allowComputerUse: false };
let lastMenuTemplate = [];

function persistPath() {
  return path.join(app.getPath('userData'), 'local-runner.json');
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
  return true;
}

const SCREEN_CAPTURE_HELP = 'Screen capture is not available. In System Settings → Privacy & Security → Screen & System Audio Recording, enable Dobby, then fully quit (Cmd+Q) and reopen the app.';

function encodeScreenshot(image, screenWidth, screenHeight, scale) {
  const size = image && image.getSize ? image.getSize() : { width: 0, height: 0 };
  if (!size.width || !size.height || size.width < 32 || size.height < 32) {
    throw new Error(SCREEN_CAPTURE_HELP);
  }
  const maxWidth = 1600;
  const resized = size.width > maxWidth
    ? image.resize({ width: maxWidth, quality: 'good' })
    : image;
  const jpeg = resized.toJPEG(72);
  if (!jpeg || jpeg.length < 2000) {
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
  hiddenDobbyWindows = windows;
  if (process.platform === 'darwin' && typeof app.hide === 'function') {
    try { app.hide(); } catch (_) { /* ignore */ }
  } else {
    for (const win of windows) {
      try { win.hide(); } catch (_) { /* ignore */ }
    }
  }
  return true;
}

function restoreDobby() {
  cancelDobbyRestore();
  const windows = hiddenDobbyWindows;
  hiddenDobbyWindows = null;
  if (!windows) return;
  if (process.platform === 'darwin' && typeof app.show === 'function') {
    try { app.show(); } catch (_) { /* ignore */ }
  }
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

function ensureAccessibility() {
  if (process.platform !== 'darwin' || !systemPreferences.isTrustedAccessibilityClient) return true;
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  if (trusted) return true;
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  throw new Error('macOS Accessibility permission is required. Enable Electron in System Settings → Privacy & Security → Accessibility, then fully quit (Cmd+Q) and run npm start again.');
}

async function handleComputerRequest(kind, payload) {
  console.log('[computer]', kind, 'start');
  try {
    if (kind === 'open') {
      const result = await withTimeout(runComputerAction('open', payload), 8000, 'open');
      scheduleDobbyRestore();
      console.log('[computer] open done');
      return result;
    }
    const result = await withDobbyHidden(async () => {
      if (kind === 'screenshot') {
        const raw = await withTimeout(runComputerAction('screenshot', payload), 8000, 'screenshot');
        return screenshotFromPngB64(raw);
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
  if (child) {
    try { child.kill(); } catch (_) { /* ignore */ }
    child = null;
  }
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
  child.stdout.on('data', (buf) => console.log('[runner]', buf.toString()));
  child.stderr.on('data', (buf) => console.error('[runner]', buf.toString()));
  child.on('message', async (message) => {
    if (!message || typeof message !== 'object') return;
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
      if (child) child.send({ type: 'approval-result', requestId: message.requestId, decision });
    }
    if (message.type === 'computer-request') {
      const allowed = await promptComputerUse(message.kind);
      if (!allowed) {
        if (child) child.send({ type: 'computer-result', requestId: message.requestId, error: 'Computer use denied' });
        return;
      }
      try {
        const result = await handleComputerRequest(message.kind, message.payload || {});
        if (child) child.send({ type: 'computer-result', requestId: message.requestId, result });
      } catch (err) {
        if (child) child.send({ type: 'computer-result', requestId: message.requestId, error: err.message || String(err) });
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
    if (status.state !== 'stopped') {
      setStatus({ state: 'offline', error: code ? `Runner exited ${code}` : null });
    }
    child = null;
  });
  setStatus({ state: 'starting', error: null });
  return { ok: true, status };
}

function stopRunner() {
  setStatus({ state: 'stopped' });
  if (child) {
    try { child.send({ type: 'stop' }); } catch (_) { /* ignore */ }
    setTimeout(() => {
      if (child) {
        try { child.kill(); } catch (_) { /* ignore */ }
      }
    }, 1500);
  }
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
};
