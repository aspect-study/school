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

test('the opening animation stays until the world is ready or resting, and the loading page is a quiet logo splash', () => {
  const intro = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'world', 'intro.js'), 'utf8');
  assert.match(intro, /addEventListener\('world-ready', worldIsReady\)/);
  assert.match(intro, /addEventListener\('world-resting', worldIsReady\)/);
  assert.match(intro, /el\.className \+= ' out'/);
  const css = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'world', 'intro.css'), 'utf8');
  assert.match(css, /\.i-overlay\.out \{ animation: i-out/);
  assert.match(css, /\.out \.i-card \{ animation: i-fly/);
  for (const grade of [2, 5]) {
    const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'world', 'grade-' + grade + '.html'), 'utf8');
    assert.ok(html.includes('<img class="i-logo" src="../assets/icons/grade5-512.png" alt="3DSkuwela">'), 'grade ' + grade + ' loading logo');
  }
});

test('inside the world frame the nav bar drops the home button, and the close button fits the bar', () => {
  const nav = fs.readFileSync(engineFile('nav.js'), 'utf8');
  assert.match(nav, /html\[data-embed\] #nav-home\{display:none;\}/);
  const css = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'world', 'world.css'), 'utf8');
  assert.match(css, /\.w-portal-x \{ position: absolute; top: 7px; right: 8px; width: 42px; height: 42px;/);
});

test('History Explorers has no boat card and shows the question in its own block', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'subjects', 'grade-5', 'araling-panlipunan', 'index.html'), 'utf8');
  assert.ok(!/boat|balangayMarkup/i.test(html), 'the boat card is gone');
  assert.ok(html.indexOf('class="quiz-head"') < html.indexOf('class="progress-bar"'), 'the counter row sits above the progress bar');
  assert.match(html, /\.q-card h3\{[^}]*border-left:5px solid var\(--accent\)/);
});

for (const game of ['araling-panlipunan', 'computer', 'english', 'filipino', 'gmrc', 'music-arts', 'pe-health', 'science', 'tle']) {
  test('grade 5 ' + game + ': the counter row sits above the progress bar and the question has its own block', () => {
    const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'subjects', 'grade-5', game, 'index.html'), 'utf8');
    assert.ok(html.indexOf('class="quiz-head"') < html.indexOf('class="progress-bar"'));
    assert.match(html, /#quizCounter\{padding:4px 14px;border-radius:999px;background:var\(--accent\)/);
    assert.match(html, /\.q-card h3\{[^}]*border-left:5px solid var\(--accent\)/);
  });
}
