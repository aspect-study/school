const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const FAMILY_B = ['byte-buddies', 'word-train', 'growing-good', 'batang-bayani', 'science-detectives'];

for (const app of APPS) {
  test(app.id + ' plays boss stages', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/boss.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads boss.js');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/quests.js"'), 'after quests.js');
    assert.equal(count(html, 'function startReview(boss){'), 1);
    if (app.id === 'math-mastery') {
      assert.equal(count(html, 'const ids = boss ? Recall.weakestSkill(SH_APP, LESSONS.map(l => l.id)) : Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS);'), 1);
    } else {
      assert.equal(count(html, 'currentQuizSet = boss ? Recall.pickBoss(SH_APP, reviewPool(), reviewInfo, Boss.STAGE_SIZE) : Recall.pickDue(SH_APP, reviewPool(), reviewInfo);'), 1);
    }
    assert.equal(count(html, 'title: boss ? Boss.text.stageTitle : Recall.text.reviewTitle, boss: !!boss'), 1, 'boss title and flag');
    assert.equal(count(html, 'Recall.text.reviewTitle'), 1, 'the round title comes from currentQuizMeta');
    assert.equal(count(html, "'review', currentQuizMeta.title, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview(bossAgain());"), 1, 'retry');
    assert.equal(count(html, 'function bossEvents(el){'), 1);
    assert.equal(count(html, 'function bossAgain(){'), 1);
    const score = FAMILY_B.includes(app.id) ? 'score' : 'quizScore';
    assert.equal(count(html, 'return Boss.stageResult(SH_APP, ' + score + ', currentQuizSet.length);'), 1, 'reports the stage');
    assert.equal(count(html, '.concat(window.Quests && Quests.check ? Quests.check() : []).concat(boss), el);'), 1, 'joins the popup');
    assert.match(html, /function showMedals\(el\)\{\s*var boss = bossEvents\(el\);/, 'the stage is reported first, even without fx.js or mastery.js');
    assert.equal(count(html, 'else if (window.Recall && window.Boss && Boss.wantsBoss && Boss.isStage(SH_APP)) startReview(true);'), 1, '?boss=1');
    assert.ok(html.indexOf('Boss.wantsBoss') > html.indexOf('Recall.wantsReview'), 'right after the review check');
    assert.ok(!html.includes("addEventListener('click', startReview)"), 'a click event is never taken for the boss flag');
    assert.ok(!/onclick\s*=\s*startReview\s*;/.test(html), 'nor through onclick');
  });
}

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby shows the weekly boss', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/boss.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/quests.js"'), 'after quests.js');
    const faces = '<script src="../engine/bosses.js"></script>';
    assert.equal(count(html, faces), 1, 'loads bosses.js for the boss faces in popups');
    assert.ok(html.indexOf(faces) > html.indexOf(tag), 'after boss.js');
    assert.equal(count(html, '<div class="boss" id="boss" hidden></div>'), 1);
    assert.ok(html.indexOf('id="boss"') > html.indexOf('id="quests"'), 'under the quests');
    assert.equal(count(html, 'events = Boss.ensure(cards);'), 1);
    assert.equal(count(html, "Boss.renderLobby(document.getElementById('boss'), cards);"), 1);
    assert.equal(count(html, 'events = Quests.check().concat(events);'), 1, 'one popup for quests and the boss');
  });
}

test('the parent phone page shows the boss line', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'parent', 'index.html'), 'utf8');
  assert.equal(count(html, '<script src="../engine/boss.js"></script>'), 1);
  assert.equal(count(html, '<p class="p-note" id="kid-boss"></p>'), 1);
  const js = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'parent', 'phone.js'), 'utf8');
  assert.equal(count(js, "$('kid-boss').textContent = window.Boss ? Boss.parentLine(Boss.read(child.space), Date.now()) : '';"), 1);
});
