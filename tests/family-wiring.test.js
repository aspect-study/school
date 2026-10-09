const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, ENGINE_FILES, appFile, lobbyFile, engineFile, web } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const GLOBALS_END = "'parent-panel': 'ParentPanel', world: 'World', family: 'Family', guide: 'Guide', trail: 'Trail' };";

for (const app of APPS) {
  test(app.id + ' writes family news', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/family.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads family.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/boss.js"'), 'after boss.js');
    assert.equal(count(html, GLOBALS_END), 1, 'the missing-file bar knows family.js');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows her sister', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const subjects = '<script src="../engine/subjects.js"></script>';
    const tag = '<script src="../engine/family.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, subjects), 1, 'subject names for her sister\'s news');
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(subjects) > html.indexOf('<script src="../engine/world.js"'), 'subjects.js after world.js');
    assert.ok(html.indexOf(tag) > html.indexOf(subjects), 'family.js after subjects.js');
    assert.ok(html.indexOf(tag) < html.indexOf('<script src="../engine/cloud.js"'), 'before cloud.js');
    assert.equal(count(html, GLOBALS_END), 1);
  });
}

test('the engines tell family.js their big moments', () => {
  const hook = 'news: function (kind, data) { if (root.Family && root.Family.note) root.Family.note(kind, data); }';
  for (const f of ['mastery.js', 'quests.js', 'boss.js']) assert.equal(count(fs.readFileSync(engineFile(f), 'utf8'), hook), 1, f);
});

test('cloud.js touches before a round, peeks the sisters after it, and clears the peek on sign-out', () => {
  const js = fs.readFileSync(engineFile('cloud.js'), 'utf8');
  assert.equal(count(js, 'if (root.Family && root.Family.touch) root.Family.touch();'), 1);
  assert.equal(count(js, 'return core.sync().then(function (r) { return peekFamily(remote).then(function () { return r; }); });'), 1);
  assert.equal(count(js, 'if (root.Family && root.Family.store) root.Family.store([]);'), 1);
  assert.equal(count(js, 'function peekFamily(remote) {'), 1);
  assert.equal(count(fs.readFileSync(engineFile('firebase-remote.js'), 'utf8'), 'peek: function (id, keys, counters) {'), 1);
});

test('world.js tells family.js when the map is drawn', () => {
  assert.equal(count(fs.readFileSync(engineFile('world.js'), 'utf8'), "doc.dispatchEvent(new win.CustomEvent('world-drawn', { detail: { box: box } }));"), 1);
});

test('family.js is cached for offline use and copied to the e2e site', () => {
  assert.ok(fs.readFileSync(web('sw.js'), 'utf8').includes("'engine/family.js',"));
  assert.ok(ENGINE_FILES.includes('family.js'));
});
