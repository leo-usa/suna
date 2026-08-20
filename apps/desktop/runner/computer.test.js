const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { KEY_CODES, mapToScreen, keyScript, pngSize, openCandidates, typeScript, utf8Env } = require('./computer');

describe('computer coordinate mapping', () => {
  it('maps screenshot pixels onto logical screen points', () => {
    const mapped = mapToScreen(1440, 900, {
      width: 2880,
      height: 1800,
      screen_width: 1440,
      screen_height: 900,
    });
    assert.deepEqual(mapped, { x: 720, y: 450 });
  });

  it('passes coordinates through when sizes match', () => {
    const mapped = mapToScreen(100, 50, { width: 1440, height: 900, screen_width: 1440, screen_height: 900 });
    assert.deepEqual(mapped, { x: 100, y: 50 });
  });

  it('reads PNG width and height from the IHDR chunk', () => {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89;
    buf.write('PNG', 1, 'ascii');
    buf.writeUInt32BE(2880, 16);
    buf.writeUInt32BE(1800, 20);
    assert.deepEqual(pngSize(buf), { width: 2880, height: 1800 });
  });
});

describe('computer key mapping', () => {
  it('maps return to a keyCode', () => {
    const script = keyScript('return');
    assert.match(script, /keyCode\(36\)/);
  });

  it('maps cmd+c to a command-down keystroke', () => {
    const script = keyScript('cmd+c');
    assert.match(script, /keystroke\("c"/);
    assert.match(script, /command down/);
  });

  it('maps modifiers after the letter', () => {
    const script = keyScript('c+cmd');
    assert.match(script, /keystroke\("c"/);
    assert.match(script, /command down/);
  });

  it('rejects unknown keys', () => {
    assert.throws(() => keyScript('f19'), /Unknown key/);
  });

  it('exports common key codes', () => {
    assert.equal(KEY_CODES.tab, 48);
    assert.equal(KEY_CODES.escape, 53);
  });
});

describe('computer typing', () => {
  it('keeps chinese characters in the keystroke helper', () => {
    const script = typeScript('杨宁');
    assert.match(script, /杨宁/);
  });

  it('forces utf-8 for clipboard helpers used by paste typing', () => {
    const env = utf8Env();
    assert.equal(env.LANG, 'en_US.UTF-8');
    assert.equal(env.LC_ALL, 'en_US.UTF-8');
  });
});

describe('computer app open aliases', () => {
  it('tries WeChat native names', () => {
    assert.deepEqual(openCandidates('WeChat'), ['WeChat', '微信', 'Weixin']);
    assert.deepEqual(openCandidates('微信'), ['WeChat', '微信', 'Weixin']);
  });

  it('passes through unknown app names', () => {
    assert.deepEqual(openCandidates('Calendar'), ['Calendar']);
  });
});
