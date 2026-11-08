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
    { '01-a.js': "StudyKit.lesson({\n  tag: 'Lesson 1',\n  id: 'a1',\n});", '02-b.js': "StudyKit.lesson({\n  term: 2,\n  id: 'b2',\n});", '03-c.js': "StudyKit.lesson({\n  term: 2,\n  exam: true,\n  id: \"c3\",\n});" });
  game('grade-5', 'math', 'math-mastery', "const ALL_LESSONS = [\n  { id:'a', term: 2, title:'A' },\n  { id:'b', term: 2, exam: true },\n  { id:'c' }\n];");
  return base;
}

test('termCounts reads term: 2, exam: true and the lesson ids from lesson files and the inline Math list', () => {
  assert.deepEqual(gen.termCounts(fixture()), {
    'life-lab': { lessons: 1, exams: 1, ids: ['b2', 'c3'] },
    'math-mastery': { lessons: 1, exams: 1, ids: ['a', 'b'] }
  });
});

test('web/world/term-lessons.js is up to date (run node tools/update-precache.js)', () => {
  assert.equal(fs.readFileSync(worldFile('term-lessons.js'), 'utf8').replace(/\r\n/g, '\n'), gen.termSource());
});

test('every one of the 17 games is listed', () => {
  assert.equal(Object.keys(require(worldFile('term-lessons.js'))).length, 17);
});

test('the inline Math list counts each lesson object on its own: any key order, several lines, braces in strings', () => {
  const html = "<script>\nconst ALL_LESSONS = [\n"
    + "  { id:'a', exam: true, term: 2, title:'A' },\n"
    + "  {\n    id:'b',\n    title:'B {term: 2}',\n    term: 2\n  },\n"
    + "  {\n    id:'c',\n    // term: 2 in a comment\n    exam: true,\n    generate: function () { return { q: '}' }; }\n  },\n"
    + "  { id:'d', term: 2,\n    exam: true }\n"
    + "];\nconst other = { term: 2 };\n</script>";
  assert.equal(gen.inlineLessons(html).length, 4);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'terms-'));
  const dir = path.join(base, 'grade-5', 'math');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'subject.json'), JSON.stringify({ id: 'math-mastery' }));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  assert.deepEqual(gen.termCounts(base), { 'math-mastery': { lessons: 1, exams: 2, ids: ['a', 'b', 'd'] } });
});

test('a Grade 2 lesson file has no id, so its plain title is the id its game keys it by', () => {
  const t = require(worldFile('term-lessons.js'))['byte-buddies'];
  assert.deepEqual(t.ids, ['Using the Internet Browser', 'Surfing the Web']);
});

test('History Explorers lists its nine Term 2 lesson ids', () => {
  const t = require(worldFile('term-lessons.js'))['history-explorers'];
  assert.equal(t.ids.length, 9);
  assert.ok(t.ids.includes('bandalagalyon'));
});
