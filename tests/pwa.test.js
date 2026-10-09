const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, LOBBIES, PARENT, web } = require('./paths.js');

function precacheList() {
  const sw = fs.readFileSync(web('sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('];', sw.indexOf('const PRECACHE = [')));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function siteFiles(dir = WEB) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? siteFiles(full) : [path.relative(WEB, full).split(path.sep).join('/')];
  });
}

test('the service worker precaches every page, script, manifest and icon of the site', () => {
  const list = precacheList();
  for (const file of siteFiles().filter((f) => f !== 'sw.js' && !f.startsWith('admin/'))) {
    assert.ok(list.includes(file), file + ' is missing from PRECACHE in web/sw.js. Run: node tools/update-precache.js');
  }
});

test('every precached file exists', () => {
  for (const file of precacheList()) {
    assert.ok(fs.existsSync(web(file)), 'web/sw.js precaches missing file ' + file);
  }
});

for (const { page, manifest } of [...Object.values(LOBBIES), PARENT]) {
  test(page + ' is installable and registers the service worker for the whole site', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    const dir = path.dirname(web(page));
    const linked = html.match(/<link rel="manifest" href="([^"]+)">/);
    assert.ok(linked, 'no manifest link');
    assert.equal(path.join(dir, linked[1]), web(manifest));
    assert.ok(html.includes("register('../sw.js', { scope: '../' })"), 'service worker not registered at the site root');

    const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/);
    assert.ok(touch && fs.existsSync(path.join(dir, touch[1])), 'apple-touch-icon missing');

    const m = JSON.parse(fs.readFileSync(web(manifest), 'utf8'));
    const mdir = path.dirname(web(manifest));
    assert.equal(m.display, 'standalone');
    assert.equal(path.join(mdir, m.start_url), web(page), 'start_url must open this lobby');
    assert.equal(path.resolve(mdir, m.scope), WEB, 'scope must be the site root so the games stay inside the app');
    for (const size of ['192x192', '512x512']) {
      assert.ok(m.icons.some((i) => i.sizes === size && i.purpose === 'any'), 'no ' + size + ' icon');
    }
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'no maskable icon');
    for (const icon of m.icons) {
      assert.ok(fs.existsSync(path.join(mdir, icon.src)), 'missing icon ' + icon.src);
    }
  });
}

test('the owner dashboard is never precached onto the kids tablets', () => {
  assert.ok(!precacheList().some((f) => f.startsWith('admin/')), 'web/admin must stay out of PRECACHE');
});
