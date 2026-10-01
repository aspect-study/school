const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const LOBBIES = [
  { page: 'lobby-grade5.html', manifest: 'manifest-grade5.webmanifest', sw: "register('sw.js')" },
  { page: 'grade 2/lobby.html', manifest: 'grade 2/manifest-grade2.webmanifest', sw: "register('../sw.js', { scope: '../' })" },
];

function precacheList() {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('];', sw.indexOf('const PRECACHE = [')));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function gameFiles(dir) {
  return fs.readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.webmanifest'))
    .filter((f) => !/^(verify|gg_script|sw\.js)/.test(f))
    .map((f) => (dir === '.' ? f : dir + '/' + f));
}

test('the service worker precaches every page, shared script and manifest of both grades', () => {
  const list = precacheList();
  for (const file of [...gameFiles('.'), ...gameFiles('grade 2')]) {
    assert.ok(list.includes(file), file + ' is missing from PRECACHE in sw.js');
  }
});

test('every precached file exists', () => {
  for (const file of precacheList()) {
    assert.ok(fs.existsSync(path.join(root, file)), 'sw.js precaches missing file ' + file);
  }
});

for (const { page, manifest, sw } of LOBBIES) {
  test(page + ' is installable and registers the service worker', () => {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const dir = path.dirname(path.join(root, page));
    const linked = html.match(/<link rel="manifest" href="([^"]+)">/);
    assert.ok(linked, 'no manifest link');
    assert.equal(path.join(dir, linked[1]), path.join(root, manifest));
    assert.ok(html.includes(sw), 'service worker not registered with ' + sw);

    const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/);
    assert.ok(touch && fs.existsSync(path.join(dir, touch[1])), 'apple-touch-icon missing');

    const m = JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
    const mdir = path.dirname(path.join(root, manifest));
    assert.equal(m.display, 'standalone');
    assert.equal(path.join(mdir, m.start_url), path.join(root, page), 'start_url must open this lobby');
    for (const size of ['192x192', '512x512']) {
      assert.ok(m.icons.some((i) => i.sizes === size && i.purpose === 'any'), 'no ' + size + ' icon');
    }
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'no maskable icon');
    for (const icon of m.icons) {
      assert.ok(fs.existsSync(path.join(mdir, icon.src)), 'missing icon ' + icon.src);
    }
  });
}
