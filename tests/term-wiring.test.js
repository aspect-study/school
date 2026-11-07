const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APPS, appFile } = require('./paths.js');

for (const a of APPS) {
  test(a.id + ' builds its lessons from the term-aware list', () => {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const fromKit = /(?:const|var) (?:LESSONS|lessons) = StudyKit\.lessons\(\);/.test(html);
    const fromPick = /const LESSONS = StudyKit\.pick\(ALL_LESSONS\);/.test(html);
    assert.ok(fromKit || fromPick, 'LESSONS comes from StudyKit.lessons() or StudyKit.pick(ALL_LESSONS)');
    assert.ok(!/location\.search[^\n]*term=/.test(html), 'the game never reads term= itself');
  });
}

test('a lesson file that names a term puts it on its own top-level line', () => {
  for (const a of APPS) {
    const dir = path.dirname(appFile(a.id));
    const lessons = path.join(dir, 'lessons');
    if (!fs.existsSync(lessons)) continue;
    for (const f of fs.readdirSync(lessons)) {
      const src = fs.readFileSync(path.join(lessons, f), 'utf8');
      if (!/^ {2}term\s*:/m.test(src)) continue;
      assert.match(src, /^ {2}term: [12],$/m, a.id + '/' + f + ': write "  term: 2," as its own line');
      if (/\bexam\s*:/.test(src.split('flashcards')[0])) assert.match(src, /^ {2}exam: true,$/m, a.id + '/' + f);
    }
  }
});

// Grade 2 games that key stars by lesson position must use the position in the full list, or a Term 2 lesson
// would read and write Term 1 lesson 0's stars.
test('index-keyed Grade 2 games key stars and history by the full-list position', () => {
  const keyed = APPS.filter((a) => /progress\[(?:i|currentLesson|lessonKey\(i\))\]|id: (?:currentLesson|lessonKey\(currentLesson\))\b/.test(fs.readFileSync(appFile(a.id), 'utf8')));
  assert.deepEqual(keyed.map((a) => a.grade + '/' + a.subject).sort(),
    ['2/computer', '2/english', '2/gmrc', '2/makabansa', '2/science']);
  for (const a of keyed) {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    assert.match(html, /function lessonKey\(i\) \{ return StudyKit\.all\(\)\.indexOf\(lessons\[i\]\); \}/, a.id + ': lessonKey helper');
    assert.ok(!/progress\[(?:i|currentLesson)\]/.test(html), a.id + ': no progress[i] / progress[currentLesson]');
    assert.ok(!/currentQuizMeta = \{ id: currentLesson\b/.test(html), a.id + ': quiz saves under lessonKey(currentLesson)');
    assert.ok(!/lessonOpened\([^)]*SH_TITLE, currentLesson,/.test(html), a.id + ': history logs lessonKey(currentLesson)');
    assert.match(html, /progress\[lessonKey\(i\)\]/, a.id + ': home stars read progress[lessonKey(i)]');
    assert.match(html, /currentQuizMeta = \{ id: lessonKey\(currentLesson\),/, a.id);
    assert.match(html, /lessonOpened\(SH_APP, SH_TITLE, lessonKey\(currentLesson\),/, a.id);
  }
});

// In a ?term= view the review card, the trail's review stop and the boss stop count only that view's boxes: games scope
// Recall through Recall.tidy (per-question boxes) or Recall.scopeSkills (Math Mastery's skill boxes) before renderHome.
test('every game scopes Recall to its view before the home renders', () => {
  for (const a of APPS) {
    const html = fs.readFileSync(appFile(a.id), 'utf8');
    const at = Math.max(html.indexOf('Recall.tidy(SH_APP, reviewPool()'), html.indexOf('Recall.scopeSkills(SH_APP, LESSONS.map'));
    assert.ok(at > 0, a.id + ': calls Recall.tidy or Recall.scopeSkills');
    assert.ok(at < html.lastIndexOf('renderHome();'), a.id + ': before the last renderHome()');
  }
  const recall = fs.readFileSync(path.join(__dirname, '..', 'web', 'engine', 'recall.js'), 'utf8');
  assert.match(recall, /if \(term\) core\.scope\(app, questions\.map/, 'the browser tidy scopes a term view');
  const guide = fs.readFileSync(path.join(__dirname, '..', 'web', 'engine', 'guide.js'), 'utf8');
  assert.match(guide, /Boss\.current\(\)\.stages\.filter\(bossInView\)/, 'the boss stop needs a box in view');
});
