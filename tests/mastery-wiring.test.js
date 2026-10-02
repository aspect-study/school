const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const app of APPS) {
  test(app.id + ' reports and shows lesson medals', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/mastery.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads mastery.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/recall.js"'), 'after recall.js');
    assert.equal(count(html, 'function medalLessons('), 1);
    assert.equal(count(html, 'function updateMedals('), 1);
    assert.equal(count(html, 'function showMedals('), 1);
    assert.equal(count(html, 'function medalBadge('), 1);
    assert.equal(count(html, 'Mastery.update(SH_APP, medalLessons())'), 1);
    assert.equal(count(html, 'if (medals.points) kit.award(medals.points);'), 1, 'pays new medals');
    assert.equal(count(html, "showMedals(document.getElementById('points-earned'));"), 1, 'after every round');
    const open = "showMedals(document.getElementById('points-total-badge'));";
    assert.equal(count(html, open), 1, 'on open');
    if (app.id !== 'math-mastery') assert.ok(html.indexOf('Recall.tidy(SH_APP') < html.indexOf(open), 'after the review boxes are tidied');
    assert.ok(html.indexOf(open) < html.lastIndexOf('renderHome();'), 'before the home screen is drawn');
    assert.equal(count(html, 'Mastery.renderChip(medals)'), 1, 'header chip');
    assert.equal(count(html, "if (window.Fx && Fx.celebrate) Fx.celebrate(Mastery.events(m, el.id === 'points-earned' && Recall.fixed ? Recall.fixed() : 0, SH_TITLE).concat(window.Quests && Quests.check ? Quests.check() : []), el);"), 1, 'celebrates milestones');
    assert.ok(count(html, 'medalBadge(') >= 2, 'lesson cards show the medal');
    const qtag = '<script src="../../../engine/quests.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, qtag), 1, 'loads quests.js');
    assert.ok(html.indexOf(qtag) > html.indexOf(tag), 'after mastery.js');
    assert.ok(html.indexOf(qtag) > html.indexOf('<script src="../../../engine/wallet.js"'), 'after wallet.js');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby has the mastery map', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/mastery.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/recall.js"'), 'after recall.js');
    assert.equal(count(html, '<button class="map-open" id="map-open" type="button" aria-expanded="false" aria-controls="map-view" hidden></button>'), 1);
    assert.equal(count(html, '<div class="map-view" id="map-view" hidden></div>'), 1);
    assert.ok(html.indexOf('id="map-view"') < html.indexOf('<div class="grid">'), 'above the games');
    assert.equal(count(html, "Mastery.renderMap(document.getElementById('map-view'), document.querySelectorAll('.subject-card[data-app]'))"), 1);
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows today\'s quests', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/quests.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/mastery.js"'), 'after mastery.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/wallet.js"'), 'after wallet.js');
    assert.equal(count(html, '<div class="quests" id="quests" hidden></div>'), 1);
    assert.ok(html.indexOf('id="quests"') < html.indexOf('id="review-due"'), 'above the review card');
    assert.equal(count(html, 'Quests.pick(cards);'), 1);
    assert.equal(count(html, "document.addEventListener('cloud-synced', showQuests);"), 1);
    assert.ok(!html.includes('test bonus'), 'the shop says bonus: it holds tests and quests');
  });
}

test('math mastery ticks quests when a walkthrough or case study ends, not only after a quiz', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.equal(count(html, 'Quests.check()'), 3, 'showMedals, walkthrough summary and case key');
});
