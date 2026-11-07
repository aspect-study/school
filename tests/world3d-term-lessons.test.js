const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { worldFile } = require('./paths.js');
const gen = require(path.join(__dirname, '..', 'tools', 'lesson-files.js'));

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'terms-'));
  const game = (g, s, id, html, files) => {
    const dir = path.join(base, g, s);
    fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'subject.json'), JSON.stringify({ id }));
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    Object.entries(files || {}).forEach(([f, src]) => fs.writeFileSync(path.join(dir, 'lessons', f), src));
  };
  game('grade-5', 'science', 'life-lab',
    '<script src="lessons/01-a.js"></script><script src="lessons/02-b.js"></script><script src="lessons/03-c.js"></script>',
    { '01-a.js': "StudyKit.lesson({\n  tag: 'Lesson 1',\n});", '02-b.js': "StudyKit.lesson({\n  term: 2,\n});", '03-c.js': "StudyKit.lesson({\n  term: 2,\n  exam: true,\n});" });
  game('grade-5', 'math', 'math-mastery', "const ALL_LESSONS = [\n  { id:'a', term: 2, title:'A' },\n  { id:'b', term: 2, exam: true },\n  { id:'c' }\n];");
  return base;
}

test('termCounts reads term: 2 and exam: true from lesson files and the inline Math list', () => {
  assert.deepEqual(gen.termCounts(fixture()), { 'life-lab': { lessons: 1, exams: 1 }, 'math-mastery': { lessons: 1, exams: 1 } });
});

test('web/world/term-lessons.js is up to date (run node tools/update-precache.js)', () => {
  assert.equal(fs.readFileSync(worldFile('term-lessons.js'), 'utf8').replace(/\r\n/g, '\n'), gen.termSource());
});

test('every one of the 17 games is listed', () => {
  assert.equal(Object.keys(require(worldFile('term-lessons.js'))).length, 17);
});
