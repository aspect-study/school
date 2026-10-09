const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const START = /window\.Trail && window\.Recall && Trail\.start\(\{ app: SH_APP, title: SH_TITLE, list: '([^']+)', lessons: medalLessons\(\), review: startReview, final: startFinalExam, finalStars: function \(\) \{ return starsFor\(\(progress\['final'\] \|\| 0\) \/ \((LESSONS|lessons)\.length \* FINAL_EXAM_PER_LESSON\)\); \} \}\);/g;

for (const a of APPS) {
  test(a.id + ' draws the lesson path', () => {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const tag = '<script src="../../../engine/trail.js" data-grade="grade' + a.grade + '"></script>';
    assert.equal(count(html, tag), 1, 'loads trail.js once');
    assert.ok(html.indexOf(tag) > html.indexOf('<script src="../../../engine/guide.js"'), 'after guide.js');
    assert.ok(html.indexOf(tag) < html.indexOf('StudyKit.start('), 'before StudyKit.start, which drops ?lesson= from the address');
    const starts = [...html.matchAll(START)];
    assert.equal(starts.length, 1, 'one Trail.start');
    const search = html.match(/Search\.start\(\{ list: '([^']+)', lessons: (LESSONS|lessons) \}\);/);
    assert.equal(starts[0][1], search[1], 'the same card list as the search');
    assert.equal(starts[0][2], search[2], 'the same lesson list as the search');
    assert.ok(starts[0].index > search.index, 'right after Search.start, so the search box is already there');
  });
}
