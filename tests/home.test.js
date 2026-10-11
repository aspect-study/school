const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile, lobbyFile, web, WORLDS } = require('./paths.js');
const { forwardTo, sectionOf, SECTIONS, worldFailed, FAILED_KEY } = require(engineFile('home.js'));

const HTTP = { protocol: 'https:', search: '', hash: '' };

test('a lobby that can run 3D forwards to its grade\'s world', () => {
  assert.equal(forwardTo(HTTP, 'grade5', true, false), '../world/grade-5.html');
  assert.equal(forwardTo(HTTP, 'grade2', true, false), '../world/grade-2.html');
});

test('the lobby stays without 3D, inside the frame, with ?stay=1, on a lobby section, and on file pages', () => {
  assert.equal(forwardTo(HTTP, 'grade5', false, false), null, 'no 3D');
  assert.equal(forwardTo(HTTP, 'grade5', true, true), null, 'inside the world frame');
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?stay=1' }), 'grade5', true, false), null);
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?a=1&stay=1' }), 'grade5', true, false), null);
  assert.equal(forwardTo(Object.assign({}, HTTP, { search: '?stay=10' }), 'grade5', true, false), '../world/grade-5.html');
  for (const s of SECTIONS) assert.equal(forwardTo(Object.assign({}, HTTP, { hash: '#' + s }), 'grade5', true, false), null, s);
  assert.equal(forwardTo(Object.assign({}, HTTP, { protocol: 'file:' }), 'grade5', true, false), null);
});

test('worldFailed is true only when the tab flag is "1"', () => {
  const store = (v) => ({ getItem: (k) => (k === FAILED_KEY ? v : null) });
  assert.equal(FAILED_KEY, 'world_failed_v1');
  assert.equal(worldFailed(store('1')), true);
  assert.equal(worldFailed(store('0')), false);
  assert.equal(worldFailed(store('true')), false);
  assert.equal(worldFailed(store(null)), false);
  assert.equal(worldFailed({ getItem: () => { throw new Error('blocked'); } }), false);
  assert.equal(worldFailed(undefined), false);
  assert.equal(worldFailed(null), false);
});

test('the world page uses the same failure key as home.js', () => {
  const src = fs.readFileSync(web('world/world-main.js'), 'utf8');
  assert.ok(src.includes("'" + FAILED_KEY + "'"));
  for (const page of Object.values(WORLDS)) assert.ok(fs.readFileSync(web(page), 'utf8').includes("'" + FAILED_KEY + "'"), page);
});

test('the frame shows the named lobby section, the shop when unnamed', () => {
  assert.deepEqual(SECTIONS, ['shop', 'coins', 'parent']);
  assert.equal(sectionOf('#parent'), 'parent');
  assert.equal(sectionOf('#coins'), 'coins');
  assert.equal(sectionOf('#shop'), 'shop');
  assert.equal(sectionOf(''), 'shop');
  assert.equal(sectionOf('#nope'), 'shop');
});

for (const n of [5, 2]) {
  test('grade ' + n + ' lobby loads embed.js and home.js right after learner.js', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    assert.ok(html.includes('<script src="../engine/learner.js" data-grade="grade' + n + '"></script>\n<script src="../engine/embed.js"></script>\n<script src="../engine/home.js" data-grade="grade' + n + '"></script>\n'));
  });
}

for (const n of [5, 2]) {
  test('grade ' + n + ' lobby loads lobby-embed.js last and guards its background jobs inside the frame', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(srcs.at(-1), '../engine/lobby-embed.js');
    assert.ok(!html.includes('#shop-world') && !html.includes('ShopReturn'), 'the old shop-as-a-page path is gone');
    assert.ok(html.includes('if (window.Embed && Embed.isEmbedded(window)) return;'), 'jobs skip inside the frame');
  });
}
