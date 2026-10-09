const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, ENGINE_FILES, appFile, web } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const ARMY_LINE = /window\.Army && \(boss \? Army\.start\(currentQuizSet\.length, (document\.getElementById\('(quizScreen|screen-quiz)'\)|quizScreen)\) : Army\.stop\(\)\);/;

for (const app of APPS) {
  test(app.id + ' shows the boss army in boss stages', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const boss = '<script src="../../../engine/boss.js" data-grade="grade' + app.grade + '"></script>';
    const bosses = '<script src="../../../engine/bosses.js"></script>';
    const army = '<script src="../../../engine/army.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(count(html, bosses), 1, 'loads bosses.js');
    assert.equal(count(html, army), 1, 'loads army.js');
    assert.ok(html.indexOf(boss) < html.indexOf(bosses) && html.indexOf(bosses) < html.indexOf(army), 'boss.js, bosses.js, army.js in that order');
    assert.ok(html.indexOf(army) < html.indexOf('<script src="../../../engine/study-kit.js"'), 'before study-kit.js');
    const at = html.indexOf('function startReview(boss){');
    const body = html.slice(at, at + 1500);
    const m = body.match(ARMY_LINE);
    assert.ok(m, 'startReview starts or stops the army');
    assert.ok(body.indexOf(m[0]) > body.indexOf('kit.startRound();'), 'after kit.startRound() (which stops the army)');
    assert.equal((html.match(new RegExp(ARMY_LINE.source, 'g')) || []).length, 1, 'only in startReview');
    if (m[1] !== 'quizScreen') assert.ok(html.includes('id="' + m[2] + '"'), 'the element exists');
  });
}

test('army.js and bosses.js are cached for offline use and copied to the e2e site', () => {
  const sw = fs.readFileSync(web('sw.js'), 'utf8');
  for (const f of ['bosses.js', 'army.js']) {
    assert.ok(sw.includes("'engine/" + f + "',"), f + ' in PRECACHE');
    assert.ok(ENGINE_FILES.includes(f), f + ' in ENGINE_FILES');
  }
});
