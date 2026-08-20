'use strict';

const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const KEY_CODES = {
  return: 36,
  enter: 36,
  tab: 48,
  escape: 53,
  esc: 53,
  delete: 51,
  backspace: 51,
  space: 49,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
};

function mapToScreen(x, y, meta) {
  const imageWidth = Number(meta && meta.width) || Number(meta && meta.image_width) || 0;
  const imageHeight = Number(meta && meta.height) || Number(meta && meta.image_height) || 0;
  const screenWidth = Number(meta && meta.screen_width) || imageWidth || 1;
  const screenHeight = Number(meta && meta.screen_height) || imageHeight || 1;
  const scaleX = imageWidth ? screenWidth / imageWidth : 1;
  const scaleY = imageHeight ? screenHeight / imageHeight : 1;
  return {
    x: Math.round(Number(x) * scaleX),
    y: Math.round(Number(y) * scaleY),
  };
}

function utf8Env() {
  return {
    ...process.env,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    LC_CTYPE: 'UTF-8',
  };
}

function electronClipboard() {
  try {
    const electron = require('electron');
    const clipboard = electron.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function' && typeof clipboard.readText === 'function') {
      return clipboard;
    }
  } catch (_) {
    /* node tests and the forked runner do not have Electron clipboard */
  }
  return null;
}

function runOsascript(source) {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', source],
      { timeout: 15000, encoding: 'utf8', env: utf8Env() },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || 'osascript failed').toString().trim()));
          return;
        }
        resolve((stdout || '').toString().trim());
      },
    );
  });
}

function clickScript(x, y, button, count) {
  const btn = button === 'right' ? 'right' : 'left';
  const n = Math.max(1, Math.min(3, Number(count) || 1));
  return `
ObjC.import('Cocoa');
function post(type, x, y, button) {
  const point = $.CGPointMake(x, y);
  const event = $.CGEventCreateMouseEvent(null, type, point, button);
  $.CGEventPost($.kCGHIDEventTap, event);
}
const x = ${Number(x)};
const y = ${Number(y)};
const button = ${btn === 'right' ? '$.kCGMouseButtonRight' : '$.kCGMouseButtonLeft'};
const down = ${btn === 'right' ? '$.kCGEventRightMouseDown' : '$.kCGEventLeftMouseDown'};
const up = ${btn === 'right' ? '$.kCGEventRightMouseUp' : '$.kCGEventLeftMouseUp'};
post($.kCGEventMouseMoved, x, y, button);
delay(0.03);
for (let i = 0; i < ${n}; i++) {
  post(down, x, y, button);
  delay(0.02);
  post(up, x, y, button);
  delay(0.04);
}
`;
}

function typeScript(text) {
  const escaped = JSON.stringify(String(text || ''));
  return `
const se = Application('System Events');
se.keystroke(${escaped});
`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readClipboardText() {
  const clip = electronClipboard();
  if (clip) {
    try {
      return Promise.resolve(String(clip.readText() || ''));
    } catch (_) {
      /* fall through to pbpaste */
    }
  }
  return new Promise((resolve) => {
    execFile('/usr/bin/pbpaste', { timeout: 3000, encoding: 'utf8', env: utf8Env() }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''));
    });
  });
}

function writeClipboardText(text) {
  const value = String(text ?? '');
  const clip = electronClipboard();
  if (clip) {
    try {
      clip.writeText(value);
      return Promise.resolve();
    } catch (_) {
      /* fall through to pbcopy */
    }
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/pbcopy', [], { stdio: ['pipe', 'ignore', 'pipe'], env: utf8Env() });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('pbcopy failed'));
    });
    child.stdin.end(Buffer.from(value, 'utf8'));
  });
}

async function typeViaPaste(text) {
  const value = String(text || '');
  if (!value) return { ok: true };
  const previous = await readClipboardText();
  try {
    await writeClipboardText(value);
    await runOsascript(keyScript('cmd+v'));
    await delay(80);
  } finally {
    try {
      await writeClipboardText(previous);
    } catch (_) {
      /* keep the typed text on the clipboard rather than failing the action */
    }
  }
  return { ok: true };
}

function pngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return { width: 0, height: 0 };
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') return { width: 0, height: 0 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function keyScript(key) {
  const raw = String(key || '').trim().toLowerCase();
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  const mods = { command: false, option: false, control: false, shift: false };
  let code = null;
  let letter = null;
  for (const part of parts) {
    if (part === 'cmd' || part === 'command' || part === 'meta') mods.command = true;
    else if (part === 'opt' || part === 'option' || part === 'alt') mods.option = true;
    else if (part === 'ctrl' || part === 'control') mods.control = true;
    else if (part === 'shift') mods.shift = true;
    else if (KEY_CODES[part] != null) code = KEY_CODES[part];
    else if (part.length === 1) letter = part;
    else throw new Error(`Unknown key: ${key}`);
  }
  const using = Object.entries(mods).filter(([, v]) => v).map(([k]) => `${k} down`);
  const usingArg = using.length ? `, { using: ${JSON.stringify(using)} }` : '';
  if (letter) {
    return `
const se = Application('System Events');
se.keystroke(${JSON.stringify(letter)}${usingArg});
`;
  }
  if (code == null) throw new Error(`Unknown key: ${key}`);
  return `
const se = Application('System Events');
se.keyCode(${code}${usingArg});
`;
}

function scrollScript(x, y, dy, dx) {
  return `
ObjC.import('Cocoa');
const point = $.CGPointMake(${Number(x)}, ${Number(y)});
const move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, move);
const scroll = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitLine, 2, ${Math.round(Number(dy) || 0)}, ${Math.round(Number(dx) || 0)});
$.CGEventPost($.kCGHIDEventTap, scroll);
`;
}

function screenshotWithScreencapture() {
  const filePath = path.join(os.tmpdir(), `dobby-screen-${Date.now()}.png`);
  return new Promise((resolve, reject) => {
    execFile('/usr/sbin/screencapture', ['-x', '-t', 'png', filePath], { timeout: 8000 }, (error) => {
      if (error) {
        reject(new Error(
          'Screen capture is not available. In System Settings → Privacy & Security → Screen & System Audio Recording, enable Dobby, then fully quit (Cmd+Q) and reopen the app.',
        ));
        return;
      }
      try {
        const png = fs.readFileSync(filePath);
        fs.unlink(filePath, () => {});
        const size = pngSize(png);
        const scale = size.width > 2000 ? 2 : 1;
        resolve({
          png_b64: png.toString('base64'),
          width: size.width,
          height: size.height,
          screen_width: size.width ? Math.round(size.width / scale) : 0,
          screen_height: size.height ? Math.round(size.height / scale) : 0,
          scale,
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

const APP_ALIASES = {
  wechat: ['WeChat', '微信', 'Weixin'],
  weixin: ['WeChat', '微信', 'Weixin'],
  微信: ['WeChat', '微信', 'Weixin'],
  chrome: ['Google Chrome', 'Chrome'],
  'google chrome': ['Google Chrome', 'Chrome'],
};

function openCandidates(target) {
  const value = String(target || '').trim();
  if (!value) return [];
  const aliases = APP_ALIASES[value.toLowerCase()];
  return aliases ? aliases.slice() : [value];
}

function spawnOpen(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/open', args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`open failed with code ${code}`));
    });
  });
}

async function openTarget(target) {
  const value = String(target || '').trim();
  if (!value) throw new Error('Missing app or URL');
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/')) {
    await spawnOpen([value]);
    return { ok: true, opened: value };
  }
  const names = openCandidates(value);
  let lastError;
  for (const name of names) {
    try {
      await spawnOpen(['-a', name]);
      return { ok: true, opened: name };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Could not open ${value}`);
}

async function runComputerAction(kind, payload) {
  payload = payload || {};
  switch (kind) {
    case 'screenshot':
      return screenshotWithScreencapture();
    case 'click': {
      const mapped = mapToScreen(payload.x, payload.y, payload);
      await runOsascript(clickScript(mapped.x, mapped.y, payload.button, payload.count));
      return { ok: true, x: mapped.x, y: mapped.y };
    }
    case 'type':
      // keystroke() only emits keys on the current layout, so Chinese becomes
      // garbage (杨宁 → aa). Paste inserts the real Unicode and also bypasses IME.
      return typeViaPaste(payload.text);
    case 'key':
      await runOsascript(keyScript(payload.key));
      return { ok: true, key: payload.key };
    case 'scroll': {
      const mapped = mapToScreen(payload.x || 0, payload.y || 0, payload);
      await runOsascript(scrollScript(mapped.x, mapped.y, payload.dy, payload.dx));
      return { ok: true };
    }
    case 'open':
      return openTarget(payload.target);
    default:
      throw new Error(`Unknown computer action: ${kind}`);
  }
}

module.exports = {
  KEY_CODES,
  mapToScreen,
  pngSize,
  clickScript,
  typeScript,
  typeViaPaste,
  utf8Env,
  keyScript,
  openCandidates,
  runComputerAction,
};
