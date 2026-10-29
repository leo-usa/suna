'use strict';

const { execFile } = require('child_process');

const VK = {
  return: 0x0d,
  enter: 0x0d,
  tab: 0x09,
  escape: 0x1b,
  esc: 0x1b,
  delete: 0x2e,
  backspace: 0x08,
  space: 0x20,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  home: 0x24,
  end: 0x23,
  pageup: 0x21,
  pagedown: 0x22,
};

const VK_CONTROL = 0x11;
const VK_MENU = 0x12;
const VK_SHIFT = 0x10;
const VK_LWIN = 0x5b;

const APP_ALIASES = {
  wechat: ['WeChat', '微信', 'Weixin'],
  weixin: ['WeChat', '微信', 'Weixin'],
  微信: ['WeChat', '微信', 'Weixin'],
  chrome: ['chrome', 'Google Chrome'],
  'google chrome': ['chrome', 'Google Chrome'],
  notepad: ['notepad'],
};

const INPUT_TYPE = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class DobbyWin {
  const uint MOUSEEVENTF_MOVE = 0x0001;
  const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  const uint MOUSEEVENTF_LEFTUP = 0x0004;
  const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  const uint MOUSEEVENTF_WHEEL = 0x0800;
  const uint MOUSEEVENTF_HWHEEL = 0x1000;
  const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
  const uint KEYEVENTF_KEYUP = 0x0002;
  const int INPUT_MOUSE = 0;
  const int INPUT_KEYBOARD = 1;

  [StructLayout(LayoutKind.Sequential)]
  struct MOUSEINPUT {
    public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct KEYBDINPUT {
    public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
  }
  [StructLayout(LayoutKind.Explicit)]
  struct INPUTUNION {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct INPUT {
    public uint type;
    public INPUTUNION u;
  }
  [DllImport("user32.dll", SetLastError=true)]
  static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [DllImport("user32.dll")]
  static extern int GetSystemMetrics(int nIndex);

  static INPUT Mouse(int x, int y, uint data, uint flags) {
    INPUT input = new INPUT();
    input.type = INPUT_MOUSE;
    input.u.mi.dx = x;
    input.u.mi.dy = y;
    input.u.mi.mouseData = data;
    input.u.mi.dwFlags = flags;
    return input;
  }
  static void Send(INPUT[] inputs) {
    uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    if (sent != inputs.Length) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
  static void Move(int x, int y) {
    int w = Math.Max(2, GetSystemMetrics(0));
    int h = Math.Max(2, GetSystemMetrics(1));
    int ax = x * 65535 / (w - 1);
    int ay = y * 65535 / (h - 1);
    Send(new[] { Mouse(ax, ay, 0, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE) });
  }
  public static void Click(int x, int y, bool right, int count) {
    uint down = right ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
    uint up = right ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;
    if (count < 1) count = 1;
    if (count > 3) count = 3;
    int w = Math.Max(2, GetSystemMetrics(0));
    int h = Math.Max(2, GetSystemMetrics(1));
    int ax = x * 65535 / (w - 1);
    int ay = y * 65535 / (h - 1);
    uint move = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
    for (int i = 0; i < count; i++) {
      Send(new[] {
        Mouse(ax, ay, 0, move),
        Mouse(ax, ay, 0, move | down),
        Mouse(ax, ay, 0, move | up)
      });
      System.Threading.Thread.Sleep(40);
    }
  }
  public static void Wheel(int x, int y, int delta, int times, bool horizontal) {
    uint flag = horizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL;
    if (times < 1) times = 1;
    Move(x, y);
    for (int i = 0; i < times; i++) {
      Send(new[] { Mouse(0, 0, (uint)delta, flag) });
      System.Threading.Thread.Sleep(30);
    }
  }
  static INPUT Key(ushort vk, bool up) {
    INPUT input = new INPUT();
    input.type = INPUT_KEYBOARD;
    input.u.ki.wVk = vk;
    input.u.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
    return input;
  }
  public static void KeyCombo(ushort[] mods, ushort vk) {
    var list = new List<INPUT>();
    if (mods != null) foreach (ushort mod in mods) list.Add(Key(mod, false));
    list.Add(Key(vk, false));
    list.Add(Key(vk, true));
    if (mods != null) for (int i = mods.Length - 1; i >= 0; i--) list.Add(Key(mods[i], true));
    Send(list.ToArray());
  }
}
"@
`;

let lastActivatedApp = '';

function psQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function electronClipboard() {
  try {
    const electron = require('electron');
    const clipboard = electron.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function' && typeof clipboard.readText === 'function') {
      return clipboard;
    }
  } catch (_) {
    /* node tests do not have Electron */
  }
  return null;
}

function openCandidates(target) {
  const value = String(target || '').trim();
  if (!value) return [];
  const aliases = APP_ALIASES[value.toLowerCase()];
  return aliases ? aliases.slice() : [value];
}

function parseKey(key) {
  const parts = String(key || '').trim().toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  const mods = [];
  let vk = null;
  const addMod = (code) => {
    if (!mods.includes(code)) mods.push(code);
  };
  for (const part of parts) {
    if (part === 'cmd' || part === 'command' || part === 'meta' || part === 'ctrl' || part === 'control') addMod(VK_CONTROL);
    else if (part === 'alt' || part === 'opt' || part === 'option') addMod(VK_MENU);
    else if (part === 'shift') addMod(VK_SHIFT);
    else if (part === 'win' || part === 'super') addMod(VK_LWIN);
    else if (VK[part] != null) vk = VK[part];
    else if (/^[a-z]$/.test(part)) vk = part.toUpperCase().charCodeAt(0);
    else if (/^[0-9]$/.test(part)) vk = part.charCodeAt(0);
    else throw new Error(`Unknown key: ${key}`);
  }
  if (vk == null) throw new Error(`Unknown key: ${key}`);
  return { mods, vk };
}

function keyScript(key) {
  const { mods, vk } = parseKey(key);
  const modList = mods.length ? mods.map((code) => `0x${code.toString(16)}`).join(',') : '';
  return `${INPUT_TYPE}\n[DobbyWin]::KeyCombo(@(${modList}), 0x${vk.toString(16)})\n`;
}

function clickScript(x, y, button, count) {
  const right = button === 'right' ? '$true' : '$false';
  const n = Math.max(1, Math.min(3, Number(count) || 1));
  return `${INPUT_TYPE}\n[DobbyWin]::Click(${Number(x)}, ${Number(y)}, ${right}, ${n})\n`;
}

function scrollWheelDelta(step) {
  // Positive dy already becomes a negative step. Windows treats a negative wheel as scrolling down.
  return Number(step) * 120;
}

function scrollScript(x, y, dy, dx, unit, scrollTicks) {
  const { ticks, stepY, stepX } = scrollTicks(dy, dx, unit);
  const horizontal = stepY === 0 && stepX !== 0;
  const delta = horizontal ? Number(stepX) * 120 : scrollWheelDelta(stepY);
  const flag = horizontal ? '$true' : '$false';
  return `${INPUT_TYPE}\n[DobbyWin]::Wheel(${Number(x)}, ${Number(y)}, ${delta}, ${ticks}, ${flag})\n`;
}

function openScript(target, names) {
  const list = (names && names.length ? names : [target]).map(psQuote).join(', ');
  return `
$target = ${psQuote(target)}
$names = @(${list})
if ($target -match '^[a-z][a-z0-9+.-]*:' -or $target -match '^[A-Za-z]:\\\\') {
  Start-Process $target
  Write-Output $target
  exit 0
}
foreach ($name in $names) {
  try {
    Start-Process $name -ErrorAction Stop
    $shell = New-Object -ComObject WScript.Shell
    Start-Sleep -Milliseconds 200
    [void]$shell.AppActivate($name)
    Write-Output $name
    exit 0
  } catch {}
}
$apps = @(Get-StartApps -ErrorAction SilentlyContinue)
foreach ($name in $names) {
  $app = $apps | Where-Object { $_.Name -eq $name } | Select-Object -First 1
  if ($app) {
    Start-Process ("shell:AppsFolder\\" + $app.AppID)
    Write-Output $name
    exit 0
  }
}
throw "Could not open $target"
`;
}

function activateScript(name) {
  return `
$shell = New-Object -ComObject WScript.Shell
if (-not $shell.AppActivate(${psQuote(name)})) { throw 'Could not focus app' }
`;
}

function runPowerShell(script) {
  const encoded = Buffer.from(String(script), 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { timeout: 15000, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message || 'powershell failed').toString().trim()));
          return;
        }
        resolve(String(stdout || '').trim());
      },
    );
  });
}

async function readClipboardText() {
  const clip = electronClipboard();
  if (clip) {
    try {
      return String(clip.readText() || '');
    } catch (_) {
      /* fall through */
    }
  }
  try {
    return await runPowerShell('Get-Clipboard -Raw');
  } catch (_) {
    return '';
  }
}

async function writeClipboardText(text) {
  const value = String(text ?? '');
  const clip = electronClipboard();
  if (clip) {
    try {
      clip.writeText(value);
      return;
    } catch (_) {
      /* fall through */
    }
  }
  await runPowerShell(`Set-Clipboard -Value ${psQuote(value)}`);
}

async function typeViaPaste(text, replace, submit) {
  const value = String(text || '');
  if (replace) {
    await runPowerShell(keyScript('ctrl+a'));
    await delay(40);
    if (!value) {
      await runPowerShell(keyScript('backspace'));
      return { ok: true };
    }
  } else if (!value) {
    return { ok: true };
  }
  const previous = await readClipboardText();
  try {
    await writeClipboardText(value);
    await delay(40);
    await runPowerShell(keyScript('ctrl+v'));
    await delay(80);
    if (submit) {
      await delay(150);
      await runPowerShell(keyScript('return'));
    }
  } finally {
    try {
      await writeClipboardText(previous);
    } catch (_) {
      /* keep the typed text on the clipboard rather than failing the action */
    }
  }
  return { ok: true };
}

async function ensureLastAppFront() {
  if (!lastActivatedApp) return;
  try {
    await runPowerShell(activateScript(lastActivatedApp));
  } catch (_) {
    /* a failed focus should not block the next action */
  }
}

async function openTarget(target) {
  const value = String(target || '').trim();
  if (!value) throw new Error('Missing app or URL');
  const names = openCandidates(value);
  const opened = await runPowerShell(openScript(value, names));
  const name = (opened || names[0] || value).split(/\r?\n/).filter(Boolean).pop();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) lastActivatedApp = name || names[0] || value;
  else lastActivatedApp = '';
  return { ok: true, opened: name || value };
}

async function runWindowsComputerAction(kind, payload, helpers) {
  payload = payload || {};
  const mapToScreen = helpers && helpers.mapToScreen;
  const scrollTicks = helpers && helpers.scrollTicks;
  if (typeof mapToScreen !== 'function' || typeof scrollTicks !== 'function') {
    throw new Error('Windows computer actions need coordinate helpers');
  }
  if (kind !== 'open' && kind !== 'screenshot') await ensureLastAppFront();
  switch (kind) {
    case 'screenshot':
      throw new Error('Windows screenshots are captured by the desktop app.');
    case 'click': {
      const mapped = mapToScreen(payload.x, payload.y, payload);
      await runPowerShell(clickScript(mapped.x, mapped.y, payload.button, payload.count));
      return { ok: true, x: mapped.x, y: mapped.y };
    }
    case 'type':
      return typeViaPaste(payload.text, payload.replace, payload.submit);
    case 'key':
      await runPowerShell(keyScript(payload.key));
      return { ok: true, key: payload.key };
    case 'scroll': {
      const mapped = mapToScreen(payload.x || 0, payload.y || 0, payload);
      await runPowerShell(scrollScript(mapped.x, mapped.y, payload.dy, payload.dx, payload.unit, scrollTicks));
      return { ok: true };
    }
    case 'open':
      return openTarget(payload.target);
    default:
      throw new Error(`Unknown computer action: ${kind}`);
  }
}

module.exports = {
  VK,
  VK_CONTROL,
  APP_ALIASES,
  parseKey,
  keyScript,
  clickScript,
  scrollScript,
  scrollWheelDelta,
  openScript,
  openCandidates,
  activateScript,
  psQuote,
  runWindowsComputerAction,
};
