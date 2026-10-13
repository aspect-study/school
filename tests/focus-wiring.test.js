const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

test('fx.js ducks the focus music under a voice clip and under speech', () => {
  const src = fs.readFileSync(engineFile('fx.js'), 'utf8');
  const ducks = src.match(/if \(win\.Focus\) win\.Focus\.duck\(/g) || [];
  assert.equal(ducks.length, 2);
});

test('nav.js tells Focus about every screen, and its menu toggles the music', () => {
  const src = fs.readFileSync(engineFile('nav.js'), 'utf8');
  assert.match(src, /screen: function \(id\) \{ if \(win\.Focus\) win\.Focus\.screen\(id\); if \(ctl\) ctl\.screen\(id\); \}/);
  assert.match(src, /nav-focus/);
  assert.match(src, /win\.Focus\.setEnabled\(/);
  assert.match(src, /win\.Focus\.sync\(\)/);
});

const { APPS, appFile } = require('./paths.js');

for (const app of APPS) {
  test(app.id + ' loads focus.js and starts the music for a lesson, the final exam and a review round', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    assert.match(html, /engine\/fx\.js"[^>]*><\/script>\r?\n<script src="\.\.\/\.\.\/\.\.\/engine\/focus\.js"><\/script>/, 'focus.js loads right after fx.js');

    const starts = html.match(/window\.Focus && Focus\.start\(SH_APP \+ [^;]+\);/g) || [];
    assert.equal(starts.length, 3, 'three Focus.start calls');
    assert.ok(starts.some((s) => /:'\s*\+\s*\w+(\[[\w.]+\])?\.title\)/.test(s)), 'a lesson seeds from its title');
    assert.ok(starts.some((s) => s.includes("':final'")), 'the final exam has its own tune');
    assert.ok(starts.some((s) => s.includes("':boss'") && s.includes("':review'")), 'a review round has its own tune');

    assert.equal((html.match(/window\.Focus && Focus\.home\(SH_APP\);/g) || []).length, 1, 'the game plays its own theme on its lesson list');
    assert.match(html, /id="[\w-]*(flash|cards)[\w-]*"/i, 'a cards screen id the music rule recognises');
    assert.match(html, /id="[\w-]*quiz[\w-]*"/i, 'a quiz screen id the music rule recognises');
  });
}
