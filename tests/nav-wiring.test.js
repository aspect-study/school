const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile, lobbyFile } = require('./paths.js');

const OLD_BACK = ['class="btn-icon" role="button"', 'class="back-link"', 'class="back-btn"', 'Back to Home'];

for (const app of APPS) {
  test(app.id + ' has the Back, Home and Menu bar and no old back buttons', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const grade = 'grade' + app.grade;
    const order = new RegExp('engine/learner\.js" data-grade="' + grade + '"></script>\r?\n(<script src="\.\./\.\./\.\./engine/clock\.js" data-grade="' + grade + '"></script>\r?\n)?<script src="\.\./\.\./\.\./engine/nav\.js" data-grade="' + grade + '"></script>');
    assert.match(html, order, 'nav.js loads right after learner.js (and the date guard, if present)');
    assert.equal(html.split('Nav.start(').length - 1, 1, 'one Nav.start');
    assert.equal(html.split('Nav.screen(').length - 1, 1, 'showScreen tells Nav, once');
    assert.ok(html.lastIndexOf('Nav.start(') < html.lastIndexOf('renderHome();'), 'Nav.start comes before the last renderHome(); (the e2e driver goes after it)');
    for (const old of OLD_BACK) assert.ok(!html.includes(old), 'old back control left: ' + old);
  });
}

for (const grade of [5, 2]) {
  test('the grade ' + grade + ' lobby opens the shop from a #shop link', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    assert.ok(html.includes("if (location.hash === '#shop' || fromWorld)"), 'reads #shop on load');
  });
}
