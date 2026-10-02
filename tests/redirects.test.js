const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REDIRECTS, APPS, LOBBIES, web } = require('./paths.js');

test('every lobby and game has a redirect page at its old URL', () => {
  const targets = REDIRECTS.map((r) => r.to);
  for (const page of [...Object.values(LOBBIES).map((l) => l.page), ...APPS.map((a) => a.page)]) {
    assert.ok(targets.includes(page), page + ' has no redirect from its old URL');
  }
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
