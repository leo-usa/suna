const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseKey,
  keyScript,
  clickScript,
  scrollScript,
  scrollWheelDelta,
  openScript,
  openCandidates,
  activateScript,
  VK_CONTROL,
} = require('./computer-win');
const { scrollTicks, PAGE_SCROLL_TICKS } = require('./computer');

describe('windows key mapping', () => {
  it('maps cmd to Ctrl so Mac shortcuts still work', () => {
    const parsed = parseKey('cmd+a');
    assert.deepEqual(parsed.mods, [VK_CONTROL]);
    assert.equal(parsed.vk, 'A'.charCodeAt(0));
    const script = keyScript('cmd+a');
    assert.match(script, /KeyCombo/);
    assert.match(script, /0x11/);
    assert.match(script, /0x41/);
  });

  it('maps ctrl+v to the paste shortcut', () => {
    const script = keyScript('ctrl+v');
    assert.match(script, /0x11/);
    assert.match(script, /0x56/);
  });

  it('rejects unknown keys', () => {
    assert.throws(() => keyScript('f19'), /Unknown key/);
  });
});

describe('windows mouse scripts', () => {
  it('clicks the left button at screen coordinates', () => {
    const script = clickScript(120, 80, 'left', 1);
    assert.match(script, /Click\(120, 80, \$false, 1\)/);
    assert.match(script, /MOUSEEVENTF_LEFTDOWN/);
    assert.match(script, /MOUSEEVENTF_ABSOLUTE/);
  });

  it('clicks the right button', () => {
    const script = clickScript(10, 20, 'right', 2);
    assert.match(script, /Click\(10, 20, \$true, 2\)/);
    assert.match(script, /MOUSEEVENTF_RIGHTDOWN/);
  });

  it('scrolls down the page with a negative wheel delta', () => {
    assert.equal(scrollWheelDelta(-1), -120);
    const script = scrollScript(100, 200, 520, 0, 'page', scrollTicks);
    assert.match(script, /Wheel\(100, 200, -120,/);
    assert.match(script, new RegExp(String(PAGE_SCROLL_TICKS)));
    assert.match(script, /\$false\)/);
  });
});

describe('windows app open', () => {
  it('tries WeChat names and starts a URL directly', () => {
    assert.deepEqual(openCandidates('微信'), ['WeChat', '微信', 'Weixin']);
    const url = openScript('https://example.com', ['https://example.com']);
    assert.match(url, /Start-Process \$target/);
    assert.match(url, /https:\/\/example.com/);
    const app = openScript('notepad', openCandidates('notepad'));
    assert.match(app, /Start-Process \$name/);
    assert.match(app, /Get-StartApps/);
    assert.match(app, /notepad/);
  });

  it('focuses the last app by window title', () => {
    const script = activateScript("O'Hare");
    assert.match(script, /AppActivate/);
    assert.match(script, /O''Hare/);
  });
});
