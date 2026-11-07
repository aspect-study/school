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
