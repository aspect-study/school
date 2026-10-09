const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const app of APPS) {
  test(app.id + ' loads the date guard right after learner.js', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const learner = '<script src="../../../engine/learner.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, learner + '\n<script src="../../../engine/clock.js" data-grade="grade' + app.grade + '"></script>'), 1);
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads the date guard and offers the parent fix', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const learner = '<script src="../engine/learner.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, learner + '\n<script src="../engine/clock.js" data-grade="grade' + grade + '"></script>'), 1);
    assert.equal(count(html, '<div class="p-section" id="clock-section" hidden>'), 1);
    assert.equal(count(html, '<button class="p-btn" type="button" id="clock-fix">The date is right now</button>'), 1);
  });
}

test('the parent panel wires the date fix and explains a failed test score while the date is wrong', () => {
  const js = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'engine', 'parent-panel.js'), 'utf8');
  assert.equal(count(js, "$('clock-section').hidden = !(root.Clock && root.Clock.paused());"), 1);
  assert.equal(count(js, 'root.Clock.fix();'), 1);
  assert.equal(count(js, "The tablet's date looks wrong, so coins are paused. Fix the date first."), 1);
  assert.equal(count(js, 'Could not save. Storage may be full.'), 2, 'the test score and Practice these');
});
