const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { missingToolHint } = require('./runtime');

describe('host tool hints', () => {
  it('explains a missing python3', () => {
    const hint = missingToolHint('python3 /workspace/app.py', '/bin/sh: python3: command not found');
    assert.match(hint, /Python 3 was not found/);
    assert.match(hint, /cloud sandbox/);
  });

  it('explains a missing node', () => {
    const hint = missingToolHint('node index.js', 'node: command not found');
    assert.match(hint, /Node.js was not found/);
  });

  it('explains a missing git', () => {
    const hint = missingToolHint('git status', 'git: command not found');
    assert.match(hint, /Git was not found/);
  });

  it('stays quiet when the command ran', () => {
    assert.equal(missingToolHint('python3 app.py', 'hello'), '');
  });
});
