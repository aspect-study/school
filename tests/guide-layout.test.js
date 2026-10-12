const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, lobbyFile, engineFile } = require('./paths.js');

test('the coin guide keeps its list in a scroller, pins the button, and opens at the top', () => {
  const src = fs.readFileSync(engineFile('wallet.js'), 'utf8');
  assert.match(src, /\.cg-box\{display:flex;flex-direction:column;/);
  assert.match(src, /\.cg-list\{flex:1 1 auto;min-height:0;overflow-y:auto;/);
  assert.match(src, /\.cg-close\{flex:none;/);
  assert.match(src, /querySelector\('\.cg-list'\)\.scrollTop = 0;/);
  assert.match(src, /focus\(\{ preventScroll: true \}\)/);
});

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby hides itself before it paints when it will forward or sit in the world frame', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const veil = html.indexOf('<script data-veil>');
    assert.ok(veil > 0 && veil < html.indexOf('<div') && veil < html.indexOf('<script src='), 'the veil script comes before any page content or shared script');
    assert.ok(html.includes('.veil-forward body{visibility:hidden;}'));
    assert.ok(html.includes('.veil-embed body>*:not(#shop-overlay):not(#parent-overlay):not(.coin-guide){display:none !important;}'));
  });
}

test('home.js lifts the veil when the lobby stays', () => {
  const src = fs.readFileSync(engineFile('home.js'), 'utf8');
  assert.match(src, /replace\(' veil-forward', ''\)/);
});
