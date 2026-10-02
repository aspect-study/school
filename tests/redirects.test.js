const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REDIRECTS, APPS, LOBBIES, web } = require('./paths.js');

test('every old URL leads to a current lobby or game', () => {
  const pages = [...Object.values(LOBBIES).map((l) => l.page), ...APPS.map((a) => a.page)];
  for (const { from, to } of REDIRECTS) assert.ok(pages.includes(to), from + ' leads to ' + to + ', which is not a lobby or game');
  assert.equal(REDIRECTS.length, 17, 'the 2 lobbies and 15 games that existed before 2026-10-02');
});

for (const { from, to } of REDIRECTS) {
  test(from + ' forwards to ' + to + ', keeping ?reset=1 and #hash', () => {
    const html = fs.readFileSync(web(from), 'utf8');
    const rel = path.posix.relative(path.posix.dirname(from), to);
    assert.ok(fs.existsSync(path.join(path.dirname(web(from)), rel)), 'target missing: ' + rel);
    assert.ok(html.includes('location.replace(' + JSON.stringify(rel) + ' + location.search + location.hash);'), 'no script redirect to ' + rel);
    assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=' + rel + '">'), 'no meta refresh fallback');
    assert.match(html.slice(0, 1024), /<meta charset="utf-8">/i);
  });
}
