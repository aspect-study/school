const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LOBBIES, APPS, WEB, ENGINE_FILES, lobbyFile, appFile, engineFile, web } = require('./paths.js');
const { LAYOUT } = require(engineFile('world.js'));

const count = (html, s) => html.split(s).length - 1;

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby draws the campus map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/world.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads world.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/boss.js"'), 'after boss.js');
    assert.equal(count(html, '<button class="campus-toggle" id="campus-toggle" type="button" hidden></button>'), 1, 'toggle in the hero');
    assert.equal(count(html, '<div class="campus" id="campus" hidden></div>'), 1);
    assert.ok(html.indexOf('id="campus"') < html.indexOf('<div class="grid">'), 'the map sits above the cards');
    assert.equal(count(html, "World.mount(document.getElementById('campus'), document.querySelector('.grid'), document.getElementById('campus-toggle'))"), 1);
    assert.ok(html.indexOf('<script data-campus>') > html.indexOf('<script data-shop>'), 'mounted after the shop sets Wallet.canAfford');
    assert.equal(count(html, 'W.canAfford = function(){'), 1, 'the shop tells the map when a reward is affordable');
    assert.ok(html.includes("'parent-panel': 'ParentPanel', world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };"), 'the missing-file bar knows world.js');
    assert.ok(html.includes("$('shop-open').focus({ preventScroll: true });"), 'closing the shop keeps the map in view');
  });

  test('grade ' + grade + ' map has a spot for every card and a card for every spot', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const cards = [...html.matchAll(/class="subject-card" data-app="([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(Object.keys(LAYOUT['grade' + grade].apps).sort(), cards);
  });
}

test('world.js is cached for offline use and copied to the e2e site', () => {
  assert.ok(fs.readFileSync(web('sw.js'), 'utf8').includes("'engine/world.js',"));
  assert.ok(ENGINE_FILES.includes('world.js'));
});

// GitHub Pages is case-sensitive and Windows is not: World.js would work here and break online.
test('every script path matches a real file name exactly, case included', () => {
  const pages = [...Object.keys(LOBBIES).map((g) => lobbyFile(g)), ...APPS.map((a) => appFile(a.id))];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      let dir = path.dirname(file);
      for (const part of m[1].split('/')) {
        if (part === '..') { dir = path.dirname(dir); continue; }
        if (part === '.') continue;
        assert.ok(fs.readdirSync(dir).includes(part), path.relative(WEB, file) + ': ' + m[1] + ' (no "' + part + '" in ' + (path.relative(WEB, dir) || 'web') + ')');
        dir = path.join(dir, part);
      }
    }
  }
});
