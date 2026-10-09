const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOBBIES, APPS, ENGINE_FILES, lobbyFile, appFile, web } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const GLOBALS_END = "world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };";

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads the guide before the map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/guide.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    for (const before of ['boss.js', 'quests.js', 'mastery.js', 'recall.js', 'study-history.js']) {
      assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/' + before + '"'), 'after ' + before);
    }
    assert.ok(html.indexOf(tag) < html.indexOf('<script src="../engine/world.js"'), 'before world.js');
    assert.equal(count(html, GLOBALS_END), 1, 'the missing-file bar knows guide.js and trail.js');
  });
}

test('every game loads the guide', () => {
  for (const a of APPS) {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const tag = '<script src="../../../engine/guide.js" data-grade="grade' + a.grade + '"></script>';
    assert.equal(count(html, tag), 1, a.id);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/family.js"'), a.id + ': after family.js');
    assert.equal(count(html, GLOBALS_END), 1, a.id);
  }
});

test('guide.js and trail.js are cached for offline use and copied to the e2e site', () => {
  const sw = fs.readFileSync(web('sw.js'), 'utf8');
  for (const f of ['guide.js', 'trail.js']) {
    assert.ok(sw.includes("'engine/" + f + "',"), f + ' in PRECACHE');
    assert.ok(ENGINE_FILES.includes(f), f + ' in ENGINE_FILES');
  }
});
