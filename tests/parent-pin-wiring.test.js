const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, PARENT, ENGINE_FILES, lobbyFile, engineFile, web } = require('./paths.js');

const read = (f) => fs.readFileSync(f, 'utf8');
const engines = (html) => [...html.matchAll(/<script src="(?:\.\.\/)*engine\/([a-z-]+)\.js"/g)].map((m) => m[1]);

test('both new engine files are in ENGINE_FILES', () => {
  assert.ok(ENGINE_FILES.includes('parent-pin.js'));
  assert.ok(ENGINE_FILES.includes('account.js'));
});

for (const [name, file] of [['grade 5 lobby', lobbyFile(5)], ['grade 2 lobby', lobbyFile(2)], ['parent page', web(PARENT.page)]]) {
  test(name + ' loads parent-pin.js before parent-panel.js', () => {
    const list = engines(read(file));
    assert.ok(list.includes('parent-pin'), 'parent-pin.js not loaded');
    assert.ok(list.indexOf('parent-pin') < list.indexOf('parent-panel'), 'parent-pin.js must come before parent-panel.js');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby: the shop keypad uses the shared PIN check and Settings links to Account', () => {
    const html = read(lobbyFile(grade));
    assert.ok(!html.includes('0108'), 'no fixed PIN left in the lobby');
    assert.ok(!/entered === PIN/.test(html), 'shop keypad still compares with a constant');
    assert.ok(html.includes('ParentPanel.checkPin(entered)'), 'shop keypad must use ParentPanel.checkPin');
    assert.ok(html.includes('href="../index.html?account=1&amp;back=lobby/grade-' + grade + '.html"'), 'Account link');
  });
}

test('parent-panel.js keeps 0108 only as the fallback', () => {
  const js = read(engineFile('parent-panel.js'));
  assert.equal(js.split("'0108'").length - 1, 1);
  assert.ok(!/=== PIN\b/.test(js));
  assert.ok(/checkPin: checkPin/.test(js), 'checkPin exported');
});

test('cloud.js and the phone page sync the PIN; the phone links to Account', () => {
  assert.ok(read(engineFile('cloud.js')).includes('ParentPin.sync(remote)'));
  assert.ok(read(web('parent/phone.js')).includes('ParentPin.sync('));
  assert.ok(read(web(PARENT.page)).includes('href="../index.html?account=1&amp;back=parent/"'));
});

test('cloud.js links to Account when signed out; the phone pad waits for the PIN sync', () => {
  assert.ok(read(engineFile('cloud.js')).includes("'../index.html?account=1&back=lobby/grade-'"));
  assert.ok(read(web('parent/phone.js')).includes("$('pin-pad').inert"));
});

test('ParentPanel.checkPin uses ParentPin when loaded and falls back to 0108', () => {
  const vm = require('node:vm');
  const ctx = vm.createContext({});
  vm.runInContext(read(engineFile('parent-panel.js')), ctx);
  const check = (e) => vm.runInContext('ParentPanel.checkPin(' + JSON.stringify(e) + ')', ctx);
  assert.equal(check('0108'), true);
  assert.equal(check('1234'), false);
  ctx.ParentPin = { check: (e) => e === '4321' };
  assert.equal(check('4321'), true);
  assert.equal(check('0108'), false);
});
