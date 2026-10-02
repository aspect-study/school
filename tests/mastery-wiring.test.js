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
    assert.ok(count(html, 'medalBadge(') >= 2, 'lesson cards show the medal');
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
