const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, appFile, lobbyFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby loads recall.js and shows the review card', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const tag = '<script src="../engine/recall.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../engine/study-history.js"'), 'after study-history.js');
    assert.equal(count(html, '<div class="review-due" id="review-due" hidden></div>'), 1);
    assert.ok(html.indexOf('id="review-due"') < html.indexOf('<div class="grid">'), 'above the games');
    assert.equal(count(html, "Recall.renderLobby(document.getElementById('review-due'), document.querySelectorAll('.subject-card[data-app]'))"), 1);
    assert.equal(count(html, "document.addEventListener('cloud-synced', showReview);"), 1);
  });
}

const FAMILY = {
  c: ['history-explorers', 'wikaharian', 'page-turners', 'rise-shine', 'rally-ready', 'craft-corner', 'life-lab'],
  b: ['byte-buddies', 'word-train', 'growing-good', 'batang-bayani', 'science-detectives'],
  a: ['kuwentista', 'block-bot'],
};

for (const id of [].concat(FAMILY.c, FAMILY.b, FAMILY.a)) {
  test(id + ' has a Review round', () => {
    const html = fs.readFileSync(appFile(id), 'utf8');
    assert.equal(count(html, 'function reviewInfo('), 1);
    assert.equal(count(html, 'function reviewPool('), 1);
    assert.equal(count(html, 'function startReview('), 1);
    assert.equal(count(html, 'Recall.pickDue(SH_APP, reviewPool(), reviewInfo)'), 1);
    assert.equal(count(html, 'Recall.tidy(SH_APP, reviewPool(), reviewInfo, SH ? SH.list() : [])'), 1);
    assert.equal(count(html, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')"), 1, 'history kind review');
    assert.equal(count(html, 'Recall.homeCard(SH_APP)'), 1, 'home card');
    assert.equal(count(html, 'Recall.wantsReview'), 1, '?review=1 starts it');
    assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview();"), 1, 'retry replays review');
  });
}

test('math-mastery reviews due skills with fresh problems', () => {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  assert.equal(count(html, 'function startReview('), 1);
  assert.equal(count(html, 'Recall.skillsDue(SH_APP, LESSONS.map(l => l.id), REVIEW_SKILLS)'), 1);
  assert.equal(count(html, 'Recall.gradeSkill(SH_APP, id, skillTally[id].right, skillTally[id].total)'), 1);
  assert.equal(count(html, 'Recall.skillBonus(SH_APP, q.skill)'), 1);
  assert.equal(count(html, "'review', Recall.text.reviewTitle, false, currentQuizSet.length, 'review')"), 1);
  assert.equal(count(html, 'Recall.startSkills(SH_APP, ids)'), 1, 'started skills are not replayed today');
  assert.ok(html.indexOf('Recall.startSkills(SH_APP, ids)') > html.indexOf('Recall.skillsDue(SH_APP'), 'after skillsDue');
  assert.equal(count(html, 'Recall.homeCard(SH_APP, REVIEW_SKILLS)'), 1);
  assert.equal(count(html, 'Recall.wantsReview'), 1);
  assert.equal(count(html, "if (currentQuizMeta.id === 'review') return startReview();"), 1);
});
