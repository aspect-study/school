const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, PARENT, ENGINE_FILES, lobbyFile, engineFile, web } = require('./paths.js');

const pages = [
  ['grade 5 lobby', lobbyFile(5)],
  ['grade 2 lobby', lobbyFile(2)],
  ['parent page', web(PARENT.page)],
];
const read = (file) => fs.readFileSync(file, 'utf8');

test('shop-editor.js is an engine file', () => {
  assert.ok(ENGINE_FILES.includes('shop-editor.js'));
  assert.ok(fs.existsSync(engineFile('shop-editor.js')));
});

for (const [name, file] of pages) {
  test(name + ' has the editor box in the Rewards tab and loads shop-editor.js before the panel', () => {
    const html = read(file);
    const rewards = html.slice(html.indexOf('data-panel="rewards"'));
    assert.ok(rewards.indexOf('id="shop-editor"') > 0 && rewards.indexOf('id="shop-editor"') < rewards.indexOf('id="test-score"') + 400, 'editor box is in the Rewards panel');
    assert.equal(html.split('id="shop-editor"').length, 2, 'once');
    const tag = html.match(/<script src="\.\.\/engine\/shop-editor\.js"[^>]*><\/script>/);
    assert.ok(tag, 'loads shop-editor.js');
    assert.ok(html.indexOf(tag[0]) < html.indexOf('/engine/parent-panel.js"'), 'before parent-panel.js');
    assert.ok(html.indexOf('/engine/wallet.js"') < html.indexOf(tag[0]), 'after wallet.js');
  });
}

test('the Parent panel mounts the editor only when its box and the wallet shop API exist', () => {
  const js = read(engineFile('parent-panel.js'));
  assert.match(js, /root\.ShopEditor && \$\('shop-editor'\) && W && W\.shop/);
  assert.match(js, /ShopEditor\.mount\(/);
});

test('shop-editor.js is plain ES5 and never writes HTML', () => {
  const js = read(engineFile('shop-editor.js'));
  assert.ok(!js.includes('innerHTML'), 'no innerHTML');
  assert.ok(!js.includes('insertAdjacentHTML'), 'no insertAdjacentHTML');
  assert.ok(!/=>/.test(js), 'no arrow functions');
  assert.ok(!/\b(let|const)\s/.test(js), 'no let or const');
  assert.ok(!js.includes('`'), 'no template strings');
});
