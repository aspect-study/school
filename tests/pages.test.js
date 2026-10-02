const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT: root, APPS, appFile, lobbyFile } = require('./paths.js');

const pages = [lobbyFile(5), lobbyFile(2), ...APPS.map((a) => appFile(a.id))];

function fileCheck(html) {
  const start = html.indexOf('<script data-file-check>');
  return start < 0 ? null : html.slice(start, html.indexOf('</script>', start));
}

test('every game and lobby declares UTF-8 near the top', () => {
  for (const file of pages) {
    const head = fs.readFileSync(file, 'utf8').slice(0, 1024);
    assert.match(head, /<meta charset="utf-8">/i, path.relative(root, file));
  }
});

test('every page checks its shared files with the same snippet, right after the last one', () => {
  const first = fileCheck(fs.readFileSync(pages[0], 'utf8'));
  assert.ok(first, 'no file check in ' + pages[0]);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const name = path.relative(root, file);
    assert.equal(fileCheck(html), first, name + ' has a different file check');
    const lastSrc = html.lastIndexOf('<script src=');
    const lastSrcEnd = html.indexOf('</script>', lastSrc);
    assert.ok(lastSrc > 0 && html.indexOf('<script data-file-check>') > lastSrcEnd, name + ': the check must come after every shared file');
    assert.ok(!/<script src=/.test(html.slice(html.indexOf('<script data-file-check>'))), name + ': no shared file after the check');
  }
});

test('every page loads storage.js, then learner.js, before any other engine file', () => {
  for (const file of pages) {
    const engine = [...fs.readFileSync(file, 'utf8').matchAll(/<script src="(?:\.\.\/)+engine\/([a-z-]+)\.js"/g)].map((m) => m[1]);
    assert.deepEqual(engine.slice(0, 2), ['storage', 'learner'], path.relative(root, file));
  }
});
