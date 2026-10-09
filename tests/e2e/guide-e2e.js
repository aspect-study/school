// The guide's bubble on the Grade 5 map, and the lesson path in one game per home-screen family.
// Run: node tests/e2e/guide-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver, appendDriver } = require('./chrome.js');
const { LOBBIES, ENGINE_FILES, app, appFile, lobbyFile } = require('../paths.js');

const CASES = [
  { id: 'life-lab', grade: 'grade5', list: 'homeList', home: 'home', query: 'atoms' },
  { id: 'math-mastery', grade: 'grade5', list: 'lesson-grid', home: 'screen-home', query: 'divisible' },
  { id: 'word-train', grade: 'grade2', list: 'home-list', home: 'home', query: 'capital' },
];

// The game drivers step through short timers, so Chrome must run them before it dumps the page.
const WAIT_MS = 3000;
const work = makeWorkDir('guide-e2e');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

// Makes the guide bubble throw during the path's first draw, after its row, path, observer and hidden cards are in place.
function breakGuide(html, grade) {
  const tag = '<script src="../../../engine/trail.js" data-grade="' + grade + '"></script>';
  if (!html.includes(tag)) throw new Error('trail.js tag not found');
  return html.replace(tag, tag + '<script>Guide.html = function () { throw new Error("broken on purpose"); };</script>');
}

try {
  const lobbyDriver = 'var __store = Learner.storage;\n' + read('driver-guide-lobby.page.js');
  const lobby = stage(path.join(work, 'lobby'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), lobbyDriver), ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-lobby'), lobby, ''));
  assert.deepEqual(r.errors, [], 'lobby: page errors');
  assert.equal(r.slotBeforeMap, true, 'the bubble sits right above the map');
  assert.equal(r.buddy, '🦉', 'her buddy speaks');
  assert.equal(r.bossText, '⚔️ The boss is waiting in Science!');
  assert.equal(r.board, 'Science', 'the building shows the subject name');
  assert.match(r.boardLabel, /^Science \(Life Lab\)/, 'the screen-reader label still names the game');
  assert.match(r.target, /w-target/);
  assert.equal(r.road, 1);
  assert.match(r.bossHref, /subjects\/grade-5\/science\/index\.html\?reset=1&boss=1$/, 'Go keeps the card\'s ?reset=1');
  assert.match(r.visitText, /^🧭 Visit .+ for the first time$/);
  assert.equal(r.lessonText, '📘 Next stop: Matter in Science');
  assert.match(r.lessonHref, /science\/index\.html\?reset=1&lesson=b$/);
  assert.equal(r.listHidesMap, true);
  assert.equal(r.listText, '📘 Next stop: Matter in Science', 'the bubble stays in List view');
  assert.match(r.listHref, /science\/index\.html\?reset=1&lesson=b$/);
  assert.equal(r.doneShopText, '🎉 All done today! You can buy a reward in the shop', 'the welcome gift buys a reward');
  assert.equal(r.doneText,'🎉 All done today! Great work!');
  assert.equal(r.doneGo, false, 'nothing to buy: no Go');
  assert.equal(r.doneTarget, 0);
  console.log('ok lobby guide');

  for (const c of CASES) {
    const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __GUIDE = ' + JSON.stringify(c) + ';\n' + read('driver-guide-game.page.js'));
    const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
    const g = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file, '', WAIT_MS));
    assert.deepEqual(g.errors, [], c.id + ': page errors');
    assert.equal(g.order, true, c.id + ': bubble and toggle, then search, then cards, then the path');
    assert.equal(g.startScreen, true, c.id + ': opens on the home screen');
    assert.equal(g.stops, true, c.id + ': a stop per lesson');
    assert.equal(g.cardsHidden, true, c.id + ': Path view hides the lesson cards');
    assert.deepEqual(g.next, ['0'], c.id + ': the first lesson glows');
    assert.equal(g.text, true, c.id + ': the bubble names the first lesson');
    assert.equal(g.buddy, true);
    assert.deepEqual(g.nextAfter, ['1'], c.id + ': after a Bronze the next stop moves');
    assert.equal(g.hop, true, c.id + ': the buddy hops');
    assert.equal(g.textAfter, true);
    assert.equal(g.listView, true, c.id + ': List shows the cards');
    assert.equal(g.pathAgain, true, c.id + ': Path comes back');
    assert.equal(g.searchShowsCards, true, c.id + ': a search shows cards and hides the Path/List switch');
    assert.equal(g.clearShowsPath, true, c.id + ': clearing the search brings the path and the switch back');
    assert.equal(g.goOpens, true, c.id + ': Go opens the next lesson');
    assert.equal(g.card, true, c.id + ': a tapped stop shows its name');
    assert.equal(g.openOpens, true, c.id + ': Open opens that lesson');

    // The third lesson's id comes from the page (medalLessons), read back from the first run.
    // ?reset=1 first, as the lobby's Go sends it: StudyKit clears the query before Trail.start.
    const param = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __GUIDE = ' + JSON.stringify(c) + ';\n' + read('driver-guide-param.page.js'));
    const pfile = stage(path.join(work, c.id + '-param'), app(c.id).page, param, ENGINE_FILES);
    const p = readOutput(dumpDom(path.join(work, 'profile-' + c.id + '-param'), pfile, '?reset=1&lesson=' + encodeURIComponent(g.thirdId), WAIT_MS));
    assert.deepEqual(p.errors, [], c.id + ': ?lesson= page errors');
    assert.equal(p.opened, true, c.id + ': ?lesson= opens that lesson');

    // A path that throws while drawing must leave the game's home as it was, and ?lesson= must still open.
    const broken = (driver) => injectDriver(breakGuide(fs.readFileSync(appFile(c.id), 'utf8'), c.grade), 'var __GUIDE = ' + JSON.stringify(c) + ';\n' + read(driver));
    const bfile = stage(path.join(work, c.id + '-broken'), app(c.id).page, broken('driver-guide-broken.page.js'), ENGINE_FILES);
    const b = readOutput(dumpDom(path.join(work, 'profile-' + c.id + '-broken'), bfile, '', WAIT_MS));
    assert.deepEqual(b.errors, [], c.id + ': a broken path throws nothing out to the page');
    assert.equal(b.home, true, c.id + ': a broken path still opens on the home screen');
    assert.equal(b.leftovers, 0, c.id + ': a broken path leaves nothing behind');
    assert.equal(b.cardsShown, true, c.id + ': a broken path shows the lesson cards');
    assert.equal(b.stillGone, true, c.id + ': redrawing the home does not bring a broken path back');
    const bpfile = stage(path.join(work, c.id + '-broken-param'), app(c.id).page, broken('driver-guide-param.page.js'), ENGINE_FILES);
    const bp = readOutput(dumpDom(path.join(work, 'profile-' + c.id + '-broken-param'), bpfile, '?reset=1&lesson=' + encodeURIComponent(g.thirdId), WAIT_MS));
    assert.deepEqual(bp.errors, [], c.id + ': broken path with ?lesson= page errors');
    assert.equal(bp.opened, true, c.id + ': ?lesson= opens the lesson even when the path is broken');
    console.log('ok ' + c.id);
  }
} catch (err) {
  console.log('FAIL guide: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
