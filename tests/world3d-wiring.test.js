const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, WORLDS, WORLD_FILES, WORLD_ENGINES, VENDOR_FILES, web, lobbyFile } = require('./paths.js');

const ORDER = WORLD_ENGINES.map((f) => '../engine/' + f + '.js')
  .concat(VENDOR_FILES.map((f) => '../' + f), WORLD_FILES);
const NO_GRADE = ['lang', 'world', 'subjects', 'bosses'];

for (const [n, page] of Object.entries(WORLDS)) {
  const grade = 'grade' + n;

  test('world grade ' + n + ' loads its scripts in order', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    assert.match(html.slice(0, 1024), /<meta charset="utf-8">/i);
    assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]), ORDER);
    for (const f of WORLD_ENGINES) {
      const tag = NO_GRADE.includes(f) ? '<script src="../engine/' + f + '.js"></script>' : '<script src="../engine/' + f + '.js" data-grade="' + grade + '"></script>';
      assert.ok(html.includes(tag), f + (NO_GRADE.includes(f) ? ' loads without data-grade (pure helpers only)' : ' has data-grade'));
    }
    assert.ok(html.includes('<body data-grade="' + grade + '">'));
    assert.ok(html.includes('<link rel="stylesheet" href="world.css">'));
  });

  test('world grade ' + n + ' has a resting card and a last-resort check', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    for (const id of ['stage', 'loading', 'resting', 'resting-title', 'resting-line', 'resting-go']) assert.ok(html.includes('id="' + id + '"'), id);
    assert.ok(html.includes('href="../lobby/grade-' + n + '.html"'), 'the resting card goes to this grade\'s lobby');
    const last = html.lastIndexOf('<script>');
    assert.ok(last > html.lastIndexOf('<script src='), 'the check runs after every script');
    assert.ok(html.slice(last).includes('World3D.Main'), 'shows the resting card if world-main.js never loaded');
  });

  test('world grade ' + n + ' script paths match real files, case included', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    for (const m of html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      let dir = path.dirname(web(page));
      for (const part of m[1].split('/')) {
        if (part === '..') { dir = path.dirname(dir); continue; }
        assert.ok(fs.readdirSync(dir).includes(part), page + ': ' + m[1]);
        dir = path.join(dir, part);
      }
    }
  });
}

test('every world script is a file in web/world', () => {
  for (const f of WORLD_FILES) assert.ok(fs.existsSync(path.join(WEB, 'world', f)), f);
});

for (const n of Object.keys(WORLDS)) {
  test('grade ' + n + ' lobby has a Play World button in the hero', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const tag = '<a class="world-open" id="world-open" href="../world/grade-' + n + '.html">🌍 Play World</a>';
    assert.equal(html.split(tag).length - 1, 1, 'one Play World button');
    assert.ok(html.indexOf(tag) > html.indexOf('id="hero-title"') && html.indexOf(tag) < html.indexOf('id="points-combined-badge"'), 'the first thing under the hero title');
    assert.ok(html.includes('.world-open{'), 'styled');
  });

  test('grade ' + n + ' lobby forgets the world door, so 🏠 in a game opened from the lobby comes back here', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const snippet = "<script data-world>window.addEventListener('pageshow', function () { try { sessionStorage.removeItem('world_return_v1'); } catch (e) {} });</script>";
    assert.equal(html.split(snippet).length - 1, 1);
    assert.ok(html.indexOf(snippet) > html.indexOf('<script data-file-check>'), 'after the file check');
  });
}

for (const n of Object.keys(WORLDS)) {
  test('grade ' + n + ' lobby shop opened from the world sends her back to Shop Plaza when she closes it', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const shop = html.slice(html.indexOf('<script data-shop>'), html.indexOf('</script>', html.indexOf('<script data-shop>')));
    assert.ok(shop.includes("location.hash === '#shop-world'"), 'opens the shop for #shop-world');
    assert.ok(shop.includes("app: 'shop'"), 'returns to the shop place');
    assert.ok(shop.includes('window.ShopReturn = { go: function (url) { location.href = url; } };'), 'the e2e can watch where it goes');
  });
}
